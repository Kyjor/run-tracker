import Foundation
import CoreBluetooth

/// Direct BLE heart-rate monitor support (standard GATT Heart Rate service 0x180D).
/// Feeds BPM into LocationTrackingManager during a live run.

final class HRMBridgeManager: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    static let shared = HRMBridgeManager()

    private var central: CBCentralManager!
    private var connectedPeripheral: CBPeripheral?
    private var heartRateCharacteristic: CBCharacteristic?
    private var isScanning = false
    private var wantConnect = false

    private let heartRateService = CBUUID(string: "180D")
    private let heartRateMeasurement = CBUUID(string: "2A37")

    private override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: DispatchQueue.main)
    }

    /// Start scanning / reconnect for a chest strap. Call when user enables BLE HRM.
    func startScanning() {
        wantConnect = true
        guard central.state == .poweredOn else { return }
        if connectedPeripheral != nil { return }
        isScanning = true
        central.scanForPeripherals(withServices: [heartRateService], options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false,
        ])
    }

    func stopScanning() {
        wantConnect = false
        isScanning = false
        if central.isScanning {
            central.stopScan()
        }
        if let peripheral = connectedPeripheral {
            central.cancelPeripheralConnection(peripheral)
        }
        connectedPeripheral = nil
        heartRateCharacteristic = nil
    }

    func isConnected() -> Bool {
        connectedPeripheral?.state == .connected
    }

    // MARK: - CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn && wantConnect {
            startScanning()
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        central.stopScan()
        isScanning = false
        connectedPeripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices([heartRateService])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectedPeripheral = nil
        if wantConnect {
            startScanning()
        }
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connectedPeripheral = nil
        heartRateCharacteristic = nil
        if wantConnect {
            startScanning()
        }
    }

    // MARK: - CBPeripheralDelegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for service in services where service.uuid == heartRateService {
            peripheral.discoverCharacteristics([heartRateMeasurement], for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let characteristics = service.characteristics else { return }
        for characteristic in characteristics where characteristic.uuid == heartRateMeasurement {
            heartRateCharacteristic = characteristic
            peripheral.setNotifyValue(true, for: characteristic)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == heartRateMeasurement,
              let data = characteristic.value,
              data.count >= 2 else { return }

        let flags = data[0]
        let bpm: Double
        if (flags & 0x01) != 0 {
            // UINT16
            bpm = Double(UInt16(data[1]) | (UInt16(data[2]) << 8))
        } else {
            bpm = Double(data[1])
        }
        LocationTrackingManager.shared.updateHeartRate(bpm)
    }
}

// ---------------------------------------------------------------------------
// C FFI
// ---------------------------------------------------------------------------

@_cdecl("hrm_start_scan")
public func hrmStartScan() -> Int32 {
    HRMBridgeManager.shared.startScanning()
    return 0
}

@_cdecl("hrm_stop_scan")
public func hrmStopScan() -> Int32 {
    HRMBridgeManager.shared.stopScanning()
    return 0
}

@_cdecl("hrm_is_connected")
public func hrmIsConnected() -> Bool {
    HRMBridgeManager.shared.isConnected()
}
