#[cfg(target_os = "windows")]
use {std::process::Command, std::os::windows::process::CommandExt};

#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "windows")]
pub fn get_device_id() -> String {
    let output = Command::new("wmic")
        .args(["os", "get", "serialnumber"])
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
    let output = Command::new("system_profiler")
        .args(["SPHardwareDataType"])
        .output()
        .expect("Failed to execute system_profiler command");

    let output_str = String::from_utf8_lossy(&output.stdout);
    output_str
        .lines()
        .find(|line| line.contains("Serial Number"))
        .and_then(|line| line.split_whitespace().nth(3))
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