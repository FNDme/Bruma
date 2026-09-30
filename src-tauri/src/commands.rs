use crate::device;
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
    let device_id = device::device_id().await?;

    Ok(DeviceInfo {
        os,
        version: tauri_plugin_os::version().to_string(),
        device_id,
    })
}
