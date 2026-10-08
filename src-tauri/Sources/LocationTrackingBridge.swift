import Foundation
import CoreLocation
import UIKit

// ---------------------------------------------------------------------------
// Session model (matches TypeScript LiveRunSnapshot)
// ---------------------------------------------------------------------------

struct LiveRoutePoint: Codable {
    let lat: Double
    let lng: Double
    let alt: Double?
    let t: Double?
    let accuracy: Double?
}

struct LiveRunSnapshotJSON: Codable {
    var state: String
    var started_at_ms: Double
    var elapsed_seconds: Double
    var distance_meters: Double
    var points: [LiveRoutePoint]
    var last_point: LiveRoutePoint?
    var permission_warning: String?
    var current_heart_rate: Double?
    var avg_heart_rate: Double?
    var max_heart_rate: Double?
    var min_heart_rate: Double?
    var paused_total_ms: Double?
    var pause_started_ms: Double?
}

typealias LiveRunUpdateCallback = @convention(c) (UnsafeMutablePointer<CChar>?) -> Void

private func idleSnapshot() -> LiveRunSnapshotJSON {
    LiveRunSnapshotJSON(
        state: "idle",
        started_at_ms: 0,
        elapsed_seconds: 0,
        distance_meters: 0,
        points: [],
        last_point: nil,
        permission_warning: nil,
        current_heart_rate: nil,
        avg_heart_rate: nil,
        max_heart_rate: nil,
        min_heart_rate: nil,
        paused_total_ms: 0,
        pause_started_ms: nil
    )
}

private func writeJsonToResult(_ json: String, resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?, resultLen: UnsafeMutablePointer<Int>?) -> Int32 {
    guard let resultPtr, let resultLen else { return -1 }
    resultPtr.pointee = strdup(json)
    resultLen.pointee = json.utf8.count
    return 0
}

// ---------------------------------------------------------------------------
// Location tracking manager
// ---------------------------------------------------------------------------

final class LocationTrackingManager: NSObject, CLLocationManagerDelegate {
    static let shared = LocationTrackingManager()

    private let manager = CLLocationManager()
    private var session = idleSnapshot()
    private let sessionLock = NSLock()
    private var updateCallback: LiveRunUpdateCallback?
    private let sessionFileName = "active_live_run.json"
    private let minMovementMeters: Double = 3
    private let maxAccuracyMeters: Double = 50
    private var hrSampleSum: Double = 0
    private var hrSampleCount: Int = 0
    private var slowSinceMs: Double?
    private var autoPaused = false
    private let autoPauseSpeedMps: Double = 0.45
    private let autoResumeSpeedMps: Double = 1.2
    private let autoPauseAfterMs: Double = 8000

    private override init() {
        super.init()
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
        loadSessionFromDisk()
        if session.state == "running" {
            configureBackgroundUpdates()
            manager.startUpdatingLocation()
        }
    }

    func setCallback(_ callback: LiveRunUpdateCallback?) {
        sessionLock.lock()
        updateCallback = callback
        sessionLock.unlock()
    }

    func permissionStatus() -> String {
        switch CLLocationManager.authorizationStatus() {
        case .authorizedAlways:
            return "always"
        case .authorizedWhenInUse:
            return "when_in_use"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "denied"
        }
    }

    func requestPermission() -> String {
        let status = CLLocationManager.authorizationStatus()
        if status == .notDetermined {
            let semaphore = DispatchSemaphore(value: 0)
            DispatchQueue.main.async {
                self.manager.requestAlwaysAuthorization()
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
                semaphore.signal()
            }
            _ = semaphore.wait(timeout: .now() + 10)
        }
        return permissionStatus()
    }

    func startLiveRun() -> Int32 {
        let status = permissionStatus()
        if status == "denied" {
            return -1
        }

        if status == "not_determined" {
            _ = requestPermission()
            if permissionStatus() == "denied" {
                return -1
            }
        }

        sessionLock.lock()
        session = idleSnapshot()
        session.state = "running"
        session.started_at_ms = Date().timeIntervalSince1970 * 1000
        hrSampleSum = 0
        hrSampleCount = 0
        slowSinceMs = nil
        autoPaused = false
        if permissionStatus() == "when_in_use" {
            session.permission_warning = "Background tracking may stop when the phone is locked. Enable Always location in Settings for reliable tracking."
        }
        sessionLock.unlock()

        persistSession()
        notifyUpdate()

        DispatchQueue.main.async {
            self.configureBackgroundUpdates()
            self.manager.startUpdatingLocation()
        }

        // Start HealthKit live HR observer (no-op if unavailable)
        LiveHeartRateMonitor.shared.start { [weak self] bpm in
            self?.updateHeartRate(bpm)
        }

        return 0
    }

    func pauseLiveRun(automatic: Bool) {
        sessionLock.lock()
        guard session.state == "running" else {
            sessionLock.unlock()
            return
        }
        let now = Date().timeIntervalSince1970 * 1000
        session.pause_started_ms = now
        session.state = "paused"
        refreshElapsed()
        sessionLock.unlock()
        autoPaused = automatic
        slowSinceMs = nil
        if !automatic {
            DispatchQueue.main.async {
                self.manager.stopUpdatingLocation()
            }
        }
        persistSession()
        notifyUpdate()
    }

    func resumeLiveRun() {
        sessionLock.lock()
        guard session.state == "paused" else {
            sessionLock.unlock()
            return
        }
        let now = Date().timeIntervalSince1970 * 1000
        if let pauseStart = session.pause_started_ms {
            session.paused_total_ms = (session.paused_total_ms ?? 0) + (now - pauseStart)
        }
        session.pause_started_ms = nil
        session.state = "running"
        refreshElapsed()
        sessionLock.unlock()
        autoPaused = false
        slowSinceMs = nil
        DispatchQueue.main.async {
            self.configureBackgroundUpdates()
            self.manager.startUpdatingLocation()
        }
        persistSession()
        notifyUpdate()
    }

    /// Called by HealthKit / BLE bridges with a new BPM sample.
    func updateHeartRate(_ bpm: Double) {
        guard bpm > 0 && bpm < 250 else { return }
        sessionLock.lock()
        guard session.state == "running" || session.state == "paused" else {
            sessionLock.unlock()
            return
        }
        session.current_heart_rate = bpm
        guard session.state == "running" else {
            sessionLock.unlock()
            persistSession()
            notifyUpdate()
            return
        }
        hrSampleSum += bpm
        hrSampleCount += 1
        session.avg_heart_rate = hrSampleSum / Double(hrSampleCount)
        if let existingMax = session.max_heart_rate {
            session.max_heart_rate = Swift.max(existingMax, bpm)
        } else {
            session.max_heart_rate = bpm
        }
        if let existingMin = session.min_heart_rate {
            session.min_heart_rate = Swift.min(existingMin, bpm)
        } else {
            session.min_heart_rate = bpm
        }
        sessionLock.unlock()
        persistSession()
        notifyUpdate()
    }

    func stopLiveRun() -> LiveRunSnapshotJSON {
        LiveHeartRateMonitor.shared.stop()
        HRMBridgeManager.shared.stopScanning()
        manager.stopUpdatingLocation()
        sessionLock.lock()
        refreshElapsed()
        session.state = "idle"
        let snapshot = session
        session = idleSnapshot()
        hrSampleSum = 0
        hrSampleCount = 0
        sessionLock.unlock()
        autoPaused = false
        slowSinceMs = nil
        deleteSessionFile()
        notifyUpdate()
        return snapshot
    }

    func cancelLiveRun() {
        LiveHeartRateMonitor.shared.stop()
        HRMBridgeManager.shared.stopScanning()
        manager.stopUpdatingLocation()
        sessionLock.lock()
        session = idleSnapshot()
        hrSampleSum = 0
        hrSampleCount = 0
        sessionLock.unlock()
        autoPaused = false
        slowSinceMs = nil
        deleteSessionFile()
        notifyUpdate()
    }

    func currentSnapshot() -> LiveRunSnapshotJSON {
        sessionLock.lock()
        refreshElapsed()
        let snapshot = session
        sessionLock.unlock()
        return snapshot
    }

  // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        sessionLock.lock()
        let state = session.state
        let isAuto = autoPaused
        sessionLock.unlock()

        if state == "paused" && !isAuto { return }

        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > maxAccuracyMeters {
            return
        }

        if state == "paused" && isAuto {
            if location.speed >= autoResumeSpeedMps {
                resumeLiveRun()
            }
            return
        }

        guard state == "running" else { return }

        if location.speed >= 0 && location.speed < autoPauseSpeedMps {
            let now = Date().timeIntervalSince1970 * 1000
            if slowSinceMs == nil {
                slowSinceMs = now
            } else if now - (slowSinceMs ?? now) >= autoPauseAfterMs {
                pauseLiveRun(automatic: true)
                return
            }
        } else if location.speed >= autoPauseSpeedMps {
            slowSinceMs = nil
        }

        let point = LiveRoutePoint(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            alt: location.altitude,
            t: location.timestamp.timeIntervalSince1970 * 1000,
            accuracy: location.horizontalAccuracy
        )

        sessionLock.lock()
        if let last = session.points.last {
            let extra = haversineMeters(
                lat1: last.lat, lng1: last.lng,
                lat2: point.lat, lng2: point.lng
            )
            if extra < minMovementMeters {
                sessionLock.unlock()
                return
            }
            session.distance_meters += extra
        }
        session.points.append(point)
        session.last_point = point
        refreshElapsed()
        sessionLock.unlock()

        persistSession()
        notifyUpdate()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        notifyUpdate()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[LocationTracking] Error: \(error.localizedDescription)")
    }

    // MARK: - Private helpers

    private func configureBackgroundUpdates() {
        if CLLocationManager.authorizationStatus() == .authorizedAlways {
            manager.allowsBackgroundLocationUpdates = true
        } else {
            manager.allowsBackgroundLocationUpdates = false
        }
    }

    private func refreshElapsed() {
        guard session.started_at_ms > 0, session.state == "running" || session.state == "paused" else {
            session.elapsed_seconds = 0
            return
        }
        let pausedTotal = session.paused_total_ms ?? 0
        let endMs = session.state == "paused"
            ? (session.pause_started_ms ?? Date().timeIntervalSince1970 * 1000)
            : Date().timeIntervalSince1970 * 1000
        session.elapsed_seconds = max(0, (endMs - session.started_at_ms - pausedTotal) / 1000)
    }

    private func sessionFileURL() -> URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent(sessionFileName)
    }

    private func persistSession() {
        sessionLock.lock()
        let data = try? JSONEncoder().encode(session)
        sessionLock.unlock()
        guard let data, let url = sessionFileURL() else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func loadSessionFromDisk() {
        guard let url = sessionFileURL(),
              let data = try? Data(contentsOf: url),
              let loaded = try? JSONDecoder().decode(LiveRunSnapshotJSON.self, from: data) else {
            return
        }
        sessionLock.lock()
        session = loaded
        sessionLock.unlock()
    }

    private func deleteSessionFile() {
        guard let url = sessionFileURL() else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private func notifyUpdate() {
        sessionLock.lock()
        refreshElapsed()
        let snapshot = session
        let callback = updateCallback
        sessionLock.unlock()

        guard let callback else { return }
        let json = encodeLiveRunSnapshot(snapshot)
        if let cStr = strdup(json) {
            callback(cStr)
        }
    }

    private func haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
        let r = 6371000.0
        let toRad = { (deg: Double) in deg * .pi / 180 }
        let dLat = toRad(lat2 - lat1)
        let dLng = toRad(lng2 - lng1)
        let aLat1 = toRad(lat1)
        let aLat2 = toRad(lat2)
        let sinDLat = sin(dLat / 2)
        let sinDLng = sin(dLng / 2)
        let h = sinDLat * sinDLat + cos(aLat1) * cos(aLat2) * sinDLng * sinDLng
        return r * 2 * atan2(sqrt(h), sqrt(1 - h))
    }
}

private func encodeLiveRunSnapshot(_ snapshot: LiveRunSnapshotJSON) -> String {
    guard let data = try? JSONEncoder().encode(snapshot),
          let json = String(data: data, encoding: .utf8) else {
        return "{}"
    }
    return json
}

// ---------------------------------------------------------------------------
// C FFI exports
// ---------------------------------------------------------------------------

@_cdecl("register_live_run_callback")
func registerLiveRunCallback(_ callback: LiveRunUpdateCallback?) {
    LocationTrackingManager.shared.setCallback(callback)
}

@_cdecl("request_location_permission")
public func requestLocationPermission(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    let status = LocationTrackingManager.shared.requestPermission()
    return writeJsonToResult("{\"status\":\"\(status)\"}", resultPtr: resultPtr, resultLen: resultLen)
}

@_cdecl("start_live_run")
public func startLiveRunNative() -> Int32 {
    LocationTrackingManager.shared.startLiveRun()
}

@_cdecl("pause_live_run")
public func pauseLiveRunNative() -> Int32 {
    LocationTrackingManager.shared.pauseLiveRun(automatic: false)
    return 0
}

@_cdecl("resume_live_run")
public func resumeLiveRunNative() -> Int32 {
    LocationTrackingManager.shared.resumeLiveRun()
    return 0
}

@_cdecl("play_run_haptic")
public func playRunHapticNative() -> Int32 {
    DispatchQueue.main.async {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    return 0
}

@_cdecl("stop_live_run")
public func stopLiveRunNative(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    let snapshot = LocationTrackingManager.shared.stopLiveRun()
    return writeJsonToResult(encodeLiveRunSnapshot(snapshot), resultPtr: resultPtr, resultLen: resultLen)
}

@_cdecl("cancel_live_run")
public func cancelLiveRunNative() -> Int32 {
    LocationTrackingManager.shared.cancelLiveRun()
    return 0
}

@_cdecl("get_live_run_snapshot")
public func getLiveRunSnapshotNative(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    let snapshot = LocationTrackingManager.shared.currentSnapshot()
    return writeJsonToResult(encodeLiveRunSnapshot(snapshot), resultPtr: resultPtr, resultLen: resultLen)
}

@_cdecl("update_live_run_heart_rate")
public func updateLiveRunHeartRateNative(bpm: Double) -> Int32 {
    LocationTrackingManager.shared.updateHeartRate(bpm)
    return 0
}
