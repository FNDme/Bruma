use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub async fn get_antivirus_info() -> Result<Option<String>, String> {
    Ok(check_antivirus().await)
}

#[tauri::command]
pub async fn get_disk_encryption_info() -> Result<Option<String>, String> {
    Ok(check_disk_encryption().await)
}

#[tauri::command]
pub async fn get_screen_lock_info() -> Result<Option<u32>, String> {
    Ok(check_screen_lock().await)
}

#[cfg(target_os = "windows")]
pub async fn check_antivirus() -> Option<String> {
    let output = Command::new("wmic")
        .args(&[
            "/node:localhost",
            "/namespace:\\\\root\\SecurityCenter2",
            "path",
            "AntiVirusProduct",
            "Get",
            "DisplayName",
        ])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    let antivirus_names: Vec<String> = result
        .lines()
        .filter(|s| !s.trim().eq_ignore_ascii_case("DisplayName"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if antivirus_names.is_empty() {
        None
    } else {
        Some(antivirus_names.join(", "))
    }
}

#[cfg(target_os = "macos")]
pub async fn check_antivirus() -> Option<String> {
    // Check for XProtect/MRT on macOS
    let queries = [
        "SELECT * FROM xprotect_entries;",
        "SELECT * FROM xprotect_meta;",
        "SELECT * FROM launchd WHERE name LIKE '%com.apple.MRT%' OR name LIKE '%com.apple.XProtect%';",
        "SELECT * FROM processes WHERE name LIKE '%MRT%' OR name LIKE '%XProtect%';",
    ];

    for query in queries.iter() {
        let output = Command::new("sqlite3")
            .arg("/var/db/SystemPolicyConfiguration/XProtect.bundle/Contents/Resources/XProtect.meta.plist")
            .arg(query)
            .output()
            .ok()?;

        if !output.stdout.is_empty() {
            return Some("XProtect/MRT (Built-in macOS protection)".to_string());
        }
    }
    None
}

#[cfg(target_os = "linux")]
pub async fn check_antivirus() -> Option<String> {
    let output = Command::new("systemctl")
        .args(&["list-units", "--type=service", "--state=running"])
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    let processes: Vec<String> = result
        .lines()
        .filter(|line| {
            let line = line.to_lowercase();
            line.contains("clamav")
                || line.contains("sophos")
                || line.contains("eset")
                || line.contains("comodo")
                || line.contains("avg")
                || line.contains("avast")
                || line.contains("bitdefender")
        })
        .map(|s| s.trim().to_string())
        .collect();

    if processes.is_empty() {
        None
    } else {
        Some(processes.join(", "))
    }
}

#[cfg(target_os = "windows")]
pub async fn check_disk_encryption() -> Option<String> {
    let output = Command::new("powershell")
        .args(&["-Command", "(New-Object -ComObject Shell.Application).NameSpace('C:').Self.ExtendedProperty('System.Volume.BitLockerProtection')"])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();

    match result.as_str() {
        "1" => Some("BitLocker".to_string()),
        "7" => Some("Bitlocker: only space used".to_string()),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
pub async fn check_disk_encryption() -> Option<String> {
    let output = Command::new("diskutil")
        .args(&["info", "/"])
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    if result.contains("FileVault: Yes") {
        Some("FileVault".to_string())
    } else {
        None
    }
}

#[cfg(target_os = "linux")]
pub async fn check_disk_encryption() -> Option<String> {
    // Check for ecryptfs
    let ecryptfs_output = Command::new("mount").output().ok()?;

    let ecryptfs_result = String::from_utf8_lossy(&ecryptfs_output.stdout);
    if ecryptfs_result.contains("ecryptfs") {
        return Some("ecryptfs".to_string());
    }

    // Check for LUKS
    let luks_output = Command::new("lsblk").args(&["-o", "TYPE"]).output().ok()?;

    let luks_result = String::from_utf8_lossy(&luks_output.stdout);
    if luks_result.contains("crypt") {
        return Some("LUKS".to_string());
    }

    None
}

#[cfg(target_os = "windows")]
pub async fn check_screen_lock() -> Option<u32> {
    let output = Command::new("powershell")
        .args(&["-Command", r#"
            $lang = (Get-WinUserLanguageList).LocalizedName.Split(' ')[0].ToLower();
            $acPattern = if ($lang -eq 'spanish') { 'Índice de configuración de corriente alterna actual' } else { 'Current AC Power Setting Index' };
            $dcPattern = if ($lang -eq 'spanish') { 'Índice de configuración de corriente continua actual' } else { 'Current DC Power Setting Index' };

            $acSettings = (powercfg -q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Select-String -Pattern $acPattern).Line.Split(':')[1].Trim();
            $dcSettings = (powercfg -q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Select-String -Pattern $dcPattern).Line.Split(':')[1].Trim();
            $hasBattery = [bool](Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue);

            [PSCustomObject]@{
                AC = $acSettings;
                DC = $dcSettings;
                HasBattery = $hasBattery
            } | ConvertTo-Json
        "#])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    let settings: serde_json::Value = serde_json::from_str(&result).ok()?;

    let parse_hex = |s: &str| -> Option<u32> {
        let hex_str = if s.starts_with("0x") { &s[2..] } else { s };
        u32::from_str_radix(hex_str, 16).ok()
    };

    let ac_timeout = parse_hex(settings["AC"].as_str()?)?;
    let dc_timeout = parse_hex(settings["DC"].as_str()?)?;
    let has_battery = settings["HasBattery"].as_bool()?;

    let timeout = if has_battery {
        std::cmp::max(ac_timeout, dc_timeout)
    } else {
        ac_timeout
    };

    if timeout == 0 {
        None
    } else {
        Some(timeout / 60)
    }
}

#[cfg(target_os = "macos")]
pub async fn check_screen_lock() -> Option<u32> {
    let output = Command::new("sysadminctl")
        .args(&["-screenLock", "status"])
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);

    if result.contains("screenLock is off") {
        return None;
    }

    let screensaver_output = Command::new("defaults")
        .args(&["-currentHost", "read", "com.apple.screensaver", "idleTime"])
        .output()
        .ok()?;

    let screensaver_time = String::from_utf8_lossy(&screensaver_output.stdout)
        .trim()
        .parse::<u32>()
        .ok()?
        / 60;

    let display_sleep_ac = get_display_sleep("AC Power")?;
    let display_sleep_battery = get_display_sleep("Battery Power")?;

    let max_timeout = std::cmp::max(
        screensaver_time,
        std::cmp::max(display_sleep_ac, display_sleep_battery),
    );

    if result.contains("screenLock delay is immediate") {
        return Some(max_timeout);
    }

    if let Some(caps) = regex::Regex::new(r"screenLock delay is (\d+) seconds")
        .ok()?
        .captures(&result)
    {
        let screen_lock_delay = caps.get(1)?.as_str().parse::<u32>().ok()? / 60;
        return Some(max_timeout + screen_lock_delay);
    }

    None
}

#[cfg(target_os = "macos")]
fn get_display_sleep(mode: &str) -> Option<u32> {
    let output = Command::new("pmset")
        .args(&["-g", "custom"])
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    
    let lines: Vec<&str> = result.lines().collect();
    let mode_line = lines.iter().position(|line| line.contains(mode))?;
    for line in &lines[mode_line..] {
        if line.trim().starts_with("displaysleep") {
            return line
                .split_whitespace()
                .nth(1)
                .and_then(|time| time.parse::<u32>().ok());
        }
    }
    
    None
}

#[cfg(target_os = "linux")]
pub async fn check_screen_lock() -> Option<u32> {
    let desktop = Command::new("env")
        .arg("XDG_SESSION_DESKTOP")
        .output()
        .ok()
        .and_then(|output| {
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .split('=')
                .nth(1)
                .map(|s| s.to_string())
        })?;

    let desktop = if desktop == "ubuntu" {
        "gnome".to_string()
    } else if desktop == "awesome" {
        let sessions = Command::new("ls").arg("/usr/bin/*session").output().ok()?;

        if String::from_utf8_lossy(&sessions.stdout).contains("gnome") {
            "gnome".to_string()
        } else {
            desktop
        }
    } else {
        desktop
    };

    let lock_enabled = Command::new("gsettings")
        .args(&[
            "get",
            &format!("org.{}.desktop.screensaver", desktop),
            "lock-enabled",
        ])
        .output()
        .ok()?;

    if String::from_utf8_lossy(&lock_enabled.stdout).trim() != "true" {
        return None;
    }

    let idle_delay = Command::new("gsettings")
        .args(&[
            "get",
            &format!("org.{}.desktop.session", desktop),
            "idle-delay",
        ])
        .output()
        .ok()?;

    let lock_delay = Command::new("gsettings")
        .args(&[
            "get",
            &format!("org.{}.desktop.screensaver", desktop),
            "lock-delay",
        ])
        .output()
        .ok()?;

    let idle_seconds = String::from_utf8_lossy(&idle_delay.stdout)
        .trim()
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse::<u32>().ok())?;

    let lock_seconds = String::from_utf8_lossy(&lock_delay.stdout)
        .trim()
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse::<u32>().ok())?;

    Some((idle_seconds + lock_seconds) / 60)
}
