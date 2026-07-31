use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
struct PendingFitFile {
    file_name: String,
    source_path: Option<String>,
    base64_data: String,
}

#[derive(Debug, Clone, Serialize)]
struct FitImportEventPayload {
    file_name: String,
}

static PENDING_FIT_FILE: OnceLock<Mutex<Option<PendingFitFile>>> = OnceLock::new();
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

fn pending_fit_file() -> &'static Mutex<Option<PendingFitFile>> {
    PENDING_FIT_FILE.get_or_init(|| Mutex::new(None))
}

// ---------------------------------------------------------------------------
// Swift FFI declarations (iOS only)
// The @_cdecl functions in HealthKitBridge.swift are compiled into the same
// Xcode target as this Rust static library. Xcode's linker resolves them.
// We alias them with `hk_` prefix to avoid name conflicts with Tauri commands.
// ---------------------------------------------------------------------------
#[cfg(target_os = "ios")]
extern "C" {
    #[link_name = "request_healthkit_permission"]
    fn hk_request_permission() -> bool;

    #[link_name = "fetch_healthkit_workouts"]
    fn hk_fetch_workouts(
        start_date: *const std::ffi::c_char,
        end_date: *const std::ffi::c_char,
        result_ptr: *mut *mut std::ffi::c_char,
        result_len: *mut usize,
    ) -> i32;

    #[link_name = "fetch_workout_details"]
    fn hk_fetch_details(
        workout_id: *const std::ffi::c_char,
        max_hr: f64,
        result_ptr: *mut *mut std::ffi::c_char,
        result_len: *mut usize,
    ) -> i32;
}

#[cfg(target_os = "ios")]
extern "C" {
    #[link_name = "register_live_run_callback"]
    fn lt_register_callback(callback: Option<extern "C" fn(*mut std::ffi::c_char)>);

    #[link_name = "request_location_permission"]
    fn lt_request_permission(
        result_ptr: *mut *mut std::ffi::c_char,
        result_len: *mut usize,
    ) -> i32;

    #[link_name = "start_live_run"]
    fn lt_start_live_run() -> i32;

    #[link_name = "stop_live_run"]
    fn lt_stop_live_run(
        result_ptr: *mut *mut std::ffi::c_char,
        result_len: *mut usize,
    ) -> i32;

    #[link_name = "cancel_live_run"]
    fn lt_cancel_live_run() -> i32;

    #[link_name = "get_live_run_snapshot"]
    fn lt_get_live_run_snapshot(
        result_ptr: *mut *mut std::ffi::c_char,
        result_len: *mut usize,
    ) -> i32;

    #[link_name = "hrm_start_scan"]
    fn hrm_ffi_start_scan() -> i32;

    #[link_name = "hrm_stop_scan"]
    fn hrm_ffi_stop_scan() -> i32;

    #[link_name = "hrm_is_connected"]
    fn hrm_ffi_is_connected() -> bool;

    #[link_name = "admob_show_home_banner"]
    fn admob_ffi_show_home_banner(ad_unit_id: *const std::ffi::c_char) -> i32;

    #[link_name = "admob_hide_home_banner"]
    fn admob_ffi_hide_home_banner() -> i32;
}

// ---------------------------------------------------------------------------
// Live run tracking
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRoutePoint {
    pub lat: f64,
    pub lng: f64,
    pub alt: Option<f64>,
    pub t: Option<f64>,
    pub accuracy: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRunSnapshot {
    pub state: String,
    pub started_at_ms: f64,
    pub elapsed_seconds: f64,
    pub distance_meters: f64,
    pub points: Vec<LiveRoutePoint>,
    pub last_point: Option<LiveRoutePoint>,
    pub permission_warning: Option<String>,
    #[serde(default)]
    pub current_heart_rate: Option<f64>,
    #[serde(default)]
    pub avg_heart_rate: Option<f64>,
    #[serde(default)]
    pub max_heart_rate: Option<f64>,
    #[serde(default)]
    pub min_heart_rate: Option<f64>,
}

impl LiveRunSnapshot {
    fn idle() -> Self {
        Self {
            state: "idle".to_string(),
            started_at_ms: 0.0,
            elapsed_seconds: 0.0,
            distance_meters: 0.0,
            points: Vec::new(),
            last_point: None,
            permission_warning: None,
            current_heart_rate: None,
            avg_heart_rate: None,
            max_heart_rate: None,
            min_heart_rate: None,
        }
    }
}

#[derive(Debug, Deserialize)]
struct LocationPermissionResponse {
    status: String,
}

fn take_ffi_json(result_ptr: *mut std::ffi::c_char) -> Result<String, String> {
    if result_ptr.is_null() {
        return Err(String::from("null native result"));
    }
    let json = unsafe {
        std::ffi::CStr::from_ptr(result_ptr)
            .to_string_lossy()
            .into_owned()
    };
    unsafe { libc::free(result_ptr as *mut libc::c_void) };
    Ok(json)
}

fn call_ffi_json<F>(mut call: F) -> Result<String, String>
where
    F: FnMut(*mut *mut std::ffi::c_char, *mut usize) -> i32,
{
    let mut result_ptr: *mut std::ffi::c_char = std::ptr::null_mut();
    let mut result_len: usize = 0;
    let code = call(&mut result_ptr, &mut result_len);
    if code < 0 {
        return Err(format!("native call failed (code {})", code));
    }
    take_ffi_json(result_ptr)
}

#[cfg(target_os = "ios")]
extern "C" fn live_run_session_updated(json_ptr: *mut std::ffi::c_char) {
    let Ok(json) = take_ffi_json(json_ptr) else {
        return;
    };
    if let Ok(snapshot) = serde_json::from_str::<LiveRunSnapshot>(&json) {
        if let Some(handle) = APP_HANDLE.get() {
            let _ = handle.emit("live-run-tick", snapshot);
        }
    }
}

// ---------------------------------------------------------------------------
// HealthKit data structures
// ---------------------------------------------------------------------------

/// Basic workout info — returned by the list query (fast, no sub-queries)
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthKitWorkout {
    pub id: String,
    pub activity_type: String,
    pub start_date: String,
    pub end_date: String,
    pub duration_seconds: f64,
    pub distance_meters: Option<f64>,
    pub energy_burned_kcal: Option<f64>,
    pub average_heart_rate: Option<f64>,
    pub max_heart_rate: Option<f64>,
    pub temperature_celsius: Option<f64>,
    pub humidity_percent: Option<f64>,
    pub weather_condition: Option<String>,
}

/// Full metrics fetched at import time (heavier per-workout queries)
#[derive(Debug, Serialize, Deserialize)]
pub struct WorkoutDetails {
    pub hr_zone_1_seconds: Option<f64>,
    pub hr_zone_2_seconds: Option<f64>,
    pub hr_zone_3_seconds: Option<f64>,
    pub hr_zone_4_seconds: Option<f64>,
    pub hr_zone_5_seconds: Option<f64>,
    pub min_heart_rate: Option<f64>,
    pub average_heart_rate: Option<f64>,
    pub max_heart_rate: Option<f64>,
    pub average_cadence: Option<f64>,
    pub average_stride_length_meters: Option<f64>,
    pub average_ground_contact_time_ms: Option<f64>,
    pub average_vertical_oscillation_cm: Option<f64>,
    pub average_power_watts: Option<f64>,
    pub max_power_watts: Option<f64>,
    pub elevation_gain_meters: Option<f64>,
    pub elevation_loss_meters: Option<f64>,
    pub vo2_max: Option<f64>,
    pub route_points: Option<String>,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn request_healthkit_permission() -> Result<bool, String> {
    #[cfg(target_os = "ios")]
    {
        Ok(unsafe { hk_request_permission() })
    }
    #[cfg(not(target_os = "ios"))]
    {
        // Mock: return true for development/testing
        Ok(true)
    }
}

#[tauri::command]
async fn fetch_healthkit_workouts(
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<HealthKitWorkout>, String> {
    #[cfg(target_os = "ios")]
    {
        use std::ffi::{CString, CStr};

        let start_c = start_date.as_deref().map(|s| CString::new(s).unwrap());
        let end_c   = end_date.as_deref().map(|s| CString::new(s).unwrap());
        let start_ptr = start_c.as_ref().map(|c| c.as_ptr()).unwrap_or(std::ptr::null());
        let end_ptr   = end_c.as_ref().map(|c| c.as_ptr()).unwrap_or(std::ptr::null());

        let mut result_ptr: *mut std::ffi::c_char = std::ptr::null_mut();
        let mut result_len: usize = 0;

        let code = unsafe { hk_fetch_workouts(start_ptr, end_ptr, &mut result_ptr, &mut result_len) };

        if code < 0 || result_ptr.is_null() {
            return Err(format!("HealthKit fetch failed (code {})", code));
        }

        let json = unsafe { CStr::from_ptr(result_ptr).to_string_lossy().into_owned() };
        unsafe { libc::free(result_ptr as *mut libc::c_void) };

        serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))
    }
    #[cfg(not(target_os = "ios"))]
    {
        // Mock data for development/testing on Mac
        use chrono::{Utc, Duration};
        
        let now = Utc::now();
        let mut workouts = Vec::new();
        
        // Generate 5 mock workouts over the last 30 days
        for i in 0..5 {
            let days_ago = i * 6; // Spread over ~30 days
            let start = now - Duration::days(days_ago as i64) - Duration::hours(1);
            let duration_mins = 30 + (i * 5); // 30-50 min workouts
            let end = start + Duration::minutes(duration_mins as i64);
            
            let distance = 5000.0 + (i as f64 * 1000.0); // 5-9 km
            let duration_secs = duration_mins as f64 * 60.0;
            
            workouts.push(HealthKitWorkout {
                id: format!("mock-workout-{}", i),
                activity_type: if i % 2 == 0 { "running".to_string() } else { "walking".to_string() },
                start_date: start.to_rfc3339(),
                end_date: end.to_rfc3339(),
                duration_seconds: duration_secs,
                distance_meters: Some(distance),
                energy_burned_kcal: Some(300.0 + (i as f64 * 50.0)),
                average_heart_rate: Some(140.0 + (i as f64 * 10.0)),
                max_heart_rate: Some(160.0 + (i as f64 * 10.0)),
                temperature_celsius: Some(20.0 + (i as f64 * 2.0)),
                humidity_percent: Some(60.0),
                weather_condition: Some("clear".to_string()),
            });
        }
        
        Ok(workouts)
    }
}

#[tauri::command]
async fn fetch_workout_details(
    workout_id: String,
    max_heart_rate_bpm: Option<f64>,
) -> Result<WorkoutDetails, String> {
    #[cfg(target_os = "ios")]
    {
        use std::ffi::{CString, CStr};

        let id_c   = CString::new(workout_id.as_str()).unwrap();
        let max_hr = max_heart_rate_bpm.unwrap_or(190.0);

        let mut result_ptr: *mut std::ffi::c_char = std::ptr::null_mut();
        let mut result_len: usize = 0;

        let code = unsafe { hk_fetch_details(id_c.as_ptr(), max_hr, &mut result_ptr, &mut result_len) };

        if code < 0 || result_ptr.is_null() {
            return Err(format!("fetch_workout_details failed (code {})", code));
        }

        let json = unsafe { CStr::from_ptr(result_ptr).to_string_lossy().into_owned() };
        unsafe { libc::free(result_ptr as *mut libc::c_void) };

        serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))
    }
    #[cfg(not(target_os = "ios"))]
    {
        // Mock data for development/testing on Mac
        let _ = workout_id;
        let _ = max_heart_rate_bpm;
        
        // Return mock details for any workout ID
        Ok(WorkoutDetails {
            hr_zone_1_seconds: Some(300.0),
            hr_zone_2_seconds: Some(600.0),
            hr_zone_3_seconds: Some(400.0),
            hr_zone_4_seconds: Some(200.0),
            hr_zone_5_seconds: Some(100.0),
            min_heart_rate: Some(65.0),
            average_heart_rate: Some(145.0),
            max_heart_rate: Some(180.0),
            average_cadence: Some(165.0),
            average_stride_length_meters: Some(1.2),
            average_ground_contact_time_ms: Some(250.0),
            average_vertical_oscillation_cm: Some(8.5),
            average_power_watts: Some(280.0),
            max_power_watts: Some(350.0),
            elevation_gain_meters: Some(150.0),
            elevation_loss_meters: Some(120.0),
            vo2_max: Some(52.0),
            route_points: Some(r#"[{"lat":37.7749,"lng":-122.4194,"alt":10.0,"t":1000},{"lat":37.7750,"lng":-122.4195,"alt":12.0,"t":2000}]"#.to_string()),
        })
    }
}

#[tauri::command]
async fn consume_pending_fit_file() -> Result<Option<PendingFitFile>, String> {
    let mut lock = pending_fit_file()
        .lock()
        .map_err(|_| String::from("failed to lock pending FIT file state"))?;
    Ok(lock.take())
}

#[tauri::command]
async fn is_native_live_tracking_available() -> bool {
    cfg!(target_os = "ios")
}

#[tauri::command]
async fn request_location_permission() -> Result<String, String> {
    #[cfg(target_os = "ios")]
    {
        let json = call_ffi_json(|result_ptr, result_len| unsafe {
            lt_request_permission(result_ptr, result_len)
        })?;
        let parsed: LocationPermissionResponse =
            serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))?;
        Ok(parsed.status)
    }
    #[cfg(not(target_os = "ios"))]
    {
        Ok(String::from("denied"))
    }
}

#[tauri::command]
async fn start_live_run() -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let code = unsafe { lt_start_live_run() };
        if code < 0 {
            return Err(String::from("Location permission denied or unavailable"));
        }
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        Err(String::from("Native live tracking is only available on iOS"))
    }
}

#[tauri::command]
async fn stop_live_run() -> Result<LiveRunSnapshot, String> {
    #[cfg(target_os = "ios")]
    {
        let json = call_ffi_json(|result_ptr, result_len| unsafe {
            lt_stop_live_run(result_ptr, result_len)
        })?;
        serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))
    }
    #[cfg(not(target_os = "ios"))]
    {
        Err(String::from("Native live tracking is only available on iOS"))
    }
}

#[tauri::command]
async fn cancel_live_run() -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let code = unsafe { lt_cancel_live_run() };
        if code < 0 {
            return Err(format!("cancel_live_run failed (code {})", code));
        }
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
async fn get_live_run_snapshot() -> Result<LiveRunSnapshot, String> {
    #[cfg(target_os = "ios")]
    {
        let json = call_ffi_json(|result_ptr, result_len| unsafe {
            lt_get_live_run_snapshot(result_ptr, result_len)
        })?;
        serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))
    }
    #[cfg(not(target_os = "ios"))]
    {
        Ok(LiveRunSnapshot::idle())
    }
}

#[tauri::command]
async fn hrm_start_scan() -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let code = unsafe { hrm_ffi_start_scan() };
        if code < 0 {
            return Err(String::from("Failed to start HRM scan"));
        }
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        Err(String::from("BLE HRM is only available on iOS"))
    }
}

#[tauri::command]
async fn hrm_stop_scan() -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let _ = unsafe { hrm_ffi_stop_scan() };
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
async fn hrm_is_connected() -> bool {
    #[cfg(target_os = "ios")]
    {
        unsafe { hrm_ffi_is_connected() }
    }
    #[cfg(not(target_os = "ios"))]
    {
        false
    }
}

/// Show the home-screen AdMob banner (iOS). No-op when SDK is not linked.
#[tauri::command]
async fn show_home_ad_banner(ad_unit_id: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let c = std::ffi::CString::new(ad_unit_id).map_err(|e| e.to_string())?;
        let code = unsafe { admob_ffi_show_home_banner(c.as_ptr()) };
        if code != 0 {
            return Err(format!("show_home_ad_banner failed: {code}"));
        }
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = ad_unit_id;
        Ok(())
    }
}

/// Hide the home-screen AdMob banner.
#[tauri::command]
async fn hide_home_ad_banner() -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let _ = unsafe { admob_ffi_hide_home_banner() };
        Ok(())
    }
    #[cfg(not(target_os = "ios"))]
    {
        Ok(())
    }
}

fn stage_fit_file_from_url(url: &tauri::Url) -> Option<PendingFitFile> {
    if url.scheme() != "file" {
        return None;
    }

    let path = url.to_file_path().ok()?;
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());
    if extension.as_deref() != Some("fit") {
        return None;
    }

    let bytes = std::fs::read(&path).ok()?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("workout.fit")
        .to_string();
    let source_path = Some(path.to_string_lossy().to_string());
    let base64_data = base64::encode(bytes);

    Some(PendingFitFile {
        file_name,
        source_path,
        base64_data,
    })
}

#[cfg(test)]
mod tests {
    use super::stage_fit_file_from_url;
    use std::fs;

    #[test]
    fn ignores_non_fit_extensions() {
        let url = tauri::Url::parse("file:///tmp/workout.gpx").expect("valid url");
        assert!(stage_fit_file_from_url(&url).is_none());
    }

    #[test]
    fn stages_fit_file_payload() {
        let path = std::env::temp_dir().join("rwf-fit-test.fit");
        fs::write(&path, [0x10, 0x20, 0x30, 0x40]).expect("temp fit write");
        let url = tauri::Url::from_file_path(&path).expect("file url");

        let staged = stage_fit_file_from_url(&url).expect("staged payload");
        assert_eq!(staged.file_name, "rwf-fit-test.fit");
        assert!(!staged.base64_data.is_empty());

        let _ = fs::remove_file(path);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_iap::init())
        .setup(|app| {
            APP_HANDLE.set(app.handle().clone()).ok();
            #[cfg(target_os = "ios")]
            unsafe {
                lt_register_callback(Some(live_run_session_updated));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            request_healthkit_permission,
            fetch_healthkit_workouts,
            fetch_workout_details,
            consume_pending_fit_file,
            is_native_live_tracking_available,
            request_location_permission,
            start_live_run,
            stop_live_run,
            cancel_live_run,
            get_live_run_snapshot,
            hrm_start_scan,
            hrm_stop_scan,
            hrm_is_connected,
            show_home_ad_banner,
            hide_home_ad_banner,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if let Some(pending) = stage_fit_file_from_url(&url) {
                    if let Ok(mut lock) = pending_fit_file().lock() {
                        let file_name = pending.file_name.clone();
                        *lock = Some(pending);
                        let _ = app_handle.emit(
                            "fit-import-pending",
                            FitImportEventPayload { file_name },
                        );
                    }
                }
            }
        }
    });
}
