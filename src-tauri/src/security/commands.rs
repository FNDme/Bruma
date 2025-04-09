use crate::security::{check_antivirus, check_disk_encryption, check_screen_lock};
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct SecurityInfo {
    antivirus: Option<String>,
    disk_encryption: Option<String>,
    screen_lock: Option<u32>,
}

#[tauri::command]
pub async fn get_security_info() -> Result<SecurityInfo, String> {
    let antivirus = check_antivirus().await;
    let disk_encryption = check_disk_encryption().await;
    let screen_lock = check_screen_lock().await;

    Ok(SecurityInfo {
        antivirus,
        disk_encryption,
        screen_lock,
    })
} 