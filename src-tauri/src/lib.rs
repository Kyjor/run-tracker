use serde::{Deserialize, Serialize};

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
        Err("HealthKit is only available on iOS".to_string())
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
        let _ = (start_date, end_date);
        Err("HealthKit is only available on iOS".to_string())
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
        let _ = (workout_id, max_heart_rate_bpm);
        Err("HealthKit is only available on iOS".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            request_healthkit_permission,
            fetch_healthkit_workouts,
            fetch_workout_details,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
