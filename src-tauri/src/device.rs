use std::{os::windows::process::CommandExt, process::Command};

#[cfg(target_os = "windows")]
pub fn get_device_id() -> String {
    let output = Command::new("wmic")
        .args(["csproduct", "get", "uuid"])
        .creation_flags(0x08000000)
        .output()
        .expect("Failed to execute wmic command");

    let uuid = String::from_utf8_lossy(&output.stdout)
        .lines()
        .nth(1)
        .unwrap_or("unknown")
        .trim()
        .to_string();

    if uuid.is_empty() {
        "unknown".to_string()
    } else {
        uuid
    }
}

#[cfg(target_os = "macos")]
pub fn get_device_id() -> String {
    let output = Command::new("ioreg")
        .args(["-d2", "-c", "IOPlatformExpertDevice"])
        .output()
        .expect("Failed to execute ioreg command");

    let output_str = String::from_utf8_lossy(&output.stdout);
    output_str
        .lines()
        .find(|line| line.contains("IOPlatformUUID"))
        .and_then(|line| line.split('"').nth(3))
        .unwrap_or("unknown")
        .to_string()
}

#[cfg(target_os = "linux")]
pub fn get_device_id() -> String {
    if let Ok(machine_id) = std::fs::read_to_string("/etc/machine-id") {
        machine_id.trim().to_string()
    } else if let Ok(dmi_id) = std::fs::read_to_string("/sys/class/dmi/id/product_uuid") {
        dmi_id.trim().to_string()
    } else {
        "unknown".to_string()
    }
}