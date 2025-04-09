use crate::device::get_device_id;
use serde::Serialize;

#[derive(Serialize)]
pub struct DeviceInfo {
    os: String,
    version: String,
    device_id: String,
}

#[tauri::command]
pub async fn get_device_info() -> Result<DeviceInfo, String> {
    let os = tauri_plugin_os::platform().to_string();
    let device_id = get_device_id(&os);

    Ok(DeviceInfo {
        os,
        version: tauri_plugin_os::version().to_string(),
        device_id,
    })
}
