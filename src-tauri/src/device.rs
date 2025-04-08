use std::process::Command;

pub fn get_windows_device_id() -> String {
    let output = Command::new("wmic")
        .args(["csproduct", "get", "uuid"])
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

pub fn get_macos_device_id() -> String {
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

pub fn get_linux_device_id() -> String {
    if let Ok(machine_id) = std::fs::read_to_string("/etc/machine-id") {
        machine_id.trim().to_string()
    } else if let Ok(dmi_id) = std::fs::read_to_string("/sys/class/dmi/id/product_uuid") {
        dmi_id.trim().to_string()
    } else {
        "unknown".to_string()
    }
}

pub fn get_device_id(os: &str) -> String {
    match os {
        "windows" => get_windows_device_id(),
        "macos" => get_macos_device_id(),
        "linux" => get_linux_device_id(),
        _ => "unknown".to_string(),
    }
} 