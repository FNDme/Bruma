use crate::device::get_device_id;
use chrono;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri_plugin_os::{platform, version};
use crate::credentials;

#[derive(Serialize, Deserialize, Debug)]
pub struct SecurityReport {
    antivirus: Option<String>,
    disk_encryption: Option<String>,
    screen_lock: Option<u32>,
}

#[derive(Serialize, Debug)]
struct SupabaseReport {
    device_id: String,
    user_email: String,
    user_full_name: String,
    disk_encrypted: bool,
    encryption_type: String,
    antivirus_detected: bool,
    antivirus_name: String,
    screen_lock_active: bool,
    screen_lock_time: u32,
    operating_system: String,
    os_version: String,
    last_check: String,
}

#[tauri::command]
pub async fn send_security_report(
    user_email: String,
    user_full_name: String,
    report: SecurityReport,
) -> Result<bool, String> {
    let device_id = get_device_id(&tauri_plugin_os::platform().to_string());
    let credentials = credentials::get_supabase_credentials()
        .await?
        .ok_or_else(|| "Supabase credentials not configured".to_string())?;

    let supabase_report = SupabaseReport {
        device_id: device_id.clone(),
        user_email: user_email.clone(),
        user_full_name,
        disk_encrypted: report.disk_encryption.is_some(),
        encryption_type: report.disk_encryption.unwrap_or_default(),
        antivirus_detected: report.antivirus.is_some(),
        antivirus_name: report.antivirus.unwrap_or_default(),
        screen_lock_active: report.screen_lock.is_some(),
        screen_lock_time: report.screen_lock.unwrap_or_default(),
        operating_system: platform().to_string(),
        os_version: version().to_string(),
        last_check: chrono::Local::now().to_string(),
    };

    let client = Client::new();
    let response = client
        .patch(&format!("{}/rest/v1/security_reports?device_id=eq.{}&on_conflict=user_email,device_id", credentials.url, device_id))
        .header("apikey", &credentials.anon_key)
        .header("Authorization", &format!("Bearer {}", credentials.anon_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&supabase_report)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(true)
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Failed to send report: {}", error_text))
    }
}
