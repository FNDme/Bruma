//! Stable per-device identifier used to key security reports.
//!
//! The primary source on each OS is the same value earlier versions of Bruma
//! reported, so existing rows keep matching. Every resolved ID is saved in the
//! app's local data directory. When the primary source fails (for example a
//! slow `system_profiler` at login), the saved ID is used before any secondary
//! source, because secondary sources return a *different* value and would
//! make the same machine show up as a new device. Secondary sources, and
//! finally a random ID, are used only when nothing has been saved yet. Every
//! lookup is fallible (no panics).

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

#[cfg(any(target_os = "windows", target_os = "macos"))]
use std::time::Duration;

const FALLBACK_FILE: &str = "device-id.txt";
/// Per-command limit for ID lookups. A hung tool is treated as "source
/// unavailable" so the lookup (which holds [`LOOKUP_LOCK`]) always finishes.
#[cfg(any(target_os = "windows", target_os = "macos"))]
const LOOKUP_TIMEOUT: Duration = Duration::from_secs(10);

/// stdout of a successful command, or None if it failed, was missing or timed out.
#[cfg(any(target_os = "windows", target_os = "macos"))]
fn command_stdout(program: &str, args: &[&str]) -> Option<String> {
    let output = crate::security::runner::run_with_timeout(program, args, LOOKUP_TIMEOUT).ok()?;
    output.success.then_some(output.stdout)
}

static DEVICE_ID: OnceLock<String> = OnceLock::new();
static FALLBACK_DIR: OnceLock<PathBuf> = OnceLock::new();
/// Serializes the first lookup so concurrent commands do not race to create the fallback file.
static LOOKUP_LOCK: Mutex<()> = Mutex::new(());

/// Where the resolved ID is persisted. Called once during app setup.
pub fn set_fallback_dir(dir: PathBuf) {
    let _ = FALLBACK_DIR.set(dir);
}

/// Returns the cached device ID, computing it on first use.
/// Runs external commands on the first call, so async callers should use [`device_id`].
pub fn get_device_id() -> Result<String, String> {
    if let Some(id) = DEVICE_ID.get() {
        return Ok(id.clone());
    }

    let _guard = LOOKUP_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(id) = DEVICE_ID.get() {
        return Ok(id.clone());
    }

    let id = resolve_device_id()?;
    Ok(DEVICE_ID.get_or_init(|| id).clone())
}

/// Async wrapper that keeps the (possibly slow) first lookup off the async runtime.
pub async fn device_id() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(get_device_id)
        .await
        .map_err(|e| format!("Device ID lookup failed: {e}"))?
}

/// Accepts a candidate ID only if it looks like a real identifier.
fn clean_id(raw: &str) -> Option<String> {
    let id = raw.trim().trim_matches('"').trim();
    let lower = id.to_ascii_lowercase();
    let placeholder = id.is_empty()
        || lower == "unknown"
        || lower == "none"
        || lower == "not available"
        || lower == "to be filled by o.e.m."
        || lower == "default string"
        || id.chars().all(|c| c == '0' || c == '-' || c == 'F' || c == 'f');
    if placeholder { None } else { Some(id.to_string()) }
}

/// Order: primary OS source, then the saved ID, then a secondary OS source,
/// then a newly generated random ID. Whatever is chosen is saved.
fn resolve_device_id() -> Result<String, String> {
    if let Some(id) = primary_device_id() {
        if saved_device_id().as_deref() != Some(id.as_str()) {
            // Best effort: the primary source is expected to work again next time.
            if let Err(e) = save_device_id(&id) {
                eprintln!("Could not save device ID: {e}");
            }
        }
        return Ok(id);
    }

    if let Some(id) = saved_device_id() {
        return Ok(id);
    }

    if let Some(id) = secondary_device_id() {
        if let Err(e) = save_device_id(&id) {
            eprintln!("Could not save device ID: {e}");
        }
        return Ok(id);
    }

    let id = format!("bruma-{}", uuid::Uuid::new_v4());
    // A random ID must be saved, or every launch would be a new device.
    save_device_id(&id).map_err(|e| {
        format!("Could not determine a device ID and failed to save a generated one: {e}")
    })?;
    Ok(id)
}

fn saved_device_id() -> Option<String> {
    let path = FALLBACK_DIR.get()?.join(FALLBACK_FILE);
    std::fs::read_to_string(path).ok().and_then(|s| clean_id(&s))
}

fn save_device_id(id: &str) -> Result<(), String> {
    let dir = FALLBACK_DIR
        .get()
        .ok_or_else(|| "Could not determine a device ID for this computer".to_string())?;
    std::fs::create_dir_all(dir)
        .and_then(|_| std::fs::write(dir.join(FALLBACK_FILE), id))
        .map_err(|e| e.to_string())
}

/// OS serial number: the value earlier versions reported.
#[cfg(target_os = "windows")]
fn primary_device_id() -> Option<String> {
    // 1. OS serial number via WMIC (what earlier versions reported). WMIC is
    //    removed on newer Windows 11 builds, so failure is expected there.
    let wmic = command_stdout("wmic", &["os", "get", "serialnumber"]).and_then(|out| {
        out.lines()
            .map(str::trim)
            .filter(|line| !line.eq_ignore_ascii_case("SerialNumber"))
            .find_map(clean_id)
    });
    if wmic.is_some() {
        return wmic;
    }

    // 2. Same value through CIM, which works where WMIC is gone.
    let cim = command_stdout(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-CimInstance -ClassName Win32_OperatingSystem).SerialNumber",
        ],
    )
    .and_then(|out| out.lines().find_map(clean_id));
    cim
}

/// MachineGuid, created at Windows install time. A different value from the
/// primary one, so it is used only when no ID has been saved yet.
#[cfg(target_os = "windows")]
fn secondary_device_id() -> Option<String> {
    command_stdout(
        "reg",
        &["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"],
    )
    .and_then(|out| {
        out.lines().find_map(|line| {
            let mut parts = line.split_whitespace();
            match (parts.next(), parts.next(), parts.next()) {
                (Some("MachineGuid"), Some(_kind), Some(value)) => clean_id(value),
                _ => None,
            }
        })
    })
}

/// Hardware serial number (what earlier versions reported).
#[cfg(target_os = "macos")]
fn primary_device_id() -> Option<String> {
    let serial = command_stdout("system_profiler", &["SPHardwareDataType"])
        .and_then(|out| parse_macos_serial(&out));
    if serial.is_some() {
        return serial;
    }
    // Same serial from the platform expert; much faster than system_profiler.
    ioreg_platform_value("IOPlatformSerialNumber")
}

/// Hardware UUID: a different value from the serial, so it is used only when
/// no ID has been saved yet.
#[cfg(target_os = "macos")]
fn secondary_device_id() -> Option<String> {
    ioreg_platform_value("IOPlatformUUID")
}

#[cfg(target_os = "macos")]
fn ioreg_platform_value(key: &str) -> Option<String> {
    command_stdout("ioreg", &["-rd1", "-c", "IOPlatformExpertDevice"])
        .and_then(|out| parse_ioreg_value(&out, key))
}

#[cfg(target_os = "macos")]
fn parse_macos_serial(system_profiler: &str) -> Option<String> {
    system_profiler.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        if key.trim().starts_with("Serial Number") {
            clean_id(value)
        } else {
            None
        }
    })
}

#[cfg(target_os = "macos")]
fn parse_ioreg_value(ioreg: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    ioreg.lines().find_map(|line| {
        let (k, v) = line.split_once('=')?;
        if k.trim() == needle { clean_id(v) } else { None }
    })
}

#[cfg(target_os = "linux")]
fn primary_device_id() -> Option<String> {
    ["/etc/machine-id", "/var/lib/dbus/machine-id", "/sys/class/dmi/id/product_uuid"]
        .iter()
        .filter_map(|path| std::fs::read_to_string(path).ok())
        .find_map(|content| clean_id(&content))
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn primary_device_id() -> Option<String> {
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn secondary_device_id() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_placeholder_ids() {
        assert_eq!(clean_id("  "), None);
        assert_eq!(clean_id("unknown"), None);
        assert_eq!(clean_id("To be filled by O.E.M."), None);
        assert_eq!(clean_id("00000000-0000-0000-0000-000000000000"), None);
        assert_eq!(clean_id(" \"ABC123\"\n"), Some("ABC123".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn parses_macos_sources() {
        let profiler = "Hardware:\n\n    Hardware Overview:\n\n      Model Name: MacBook Pro\n      Serial Number (system): C02XYZ123ABC\n      Hardware UUID: 1234\n";
        assert_eq!(parse_macos_serial(profiler), Some("C02XYZ123ABC".to_string()));
        assert_eq!(parse_macos_serial("Model Name: Mac\n"), None);

        let ioreg = "+-o J314sAP  <class IOPlatformExpertDevice>\n    {\n      \"IOPlatformSerialNumber\" = \"C02XYZ\"\n      \"IOPlatformUUID\" = \"5A1B2C3D-0000-1111-2222-333344445555\"\n    }\n";
        assert_eq!(parse_ioreg_value(ioreg, "IOPlatformSerialNumber"), Some("C02XYZ".to_string()));
        assert_eq!(
            parse_ioreg_value(ioreg, "IOPlatformUUID"),
            Some("5A1B2C3D-0000-1111-2222-333344445555".to_string())
        );
    }

    #[test]
    fn device_id_is_cached_and_non_empty() {
        let dir = std::env::temp_dir().join(format!("bruma-device-test-{}", std::process::id()));
        set_fallback_dir(dir);
        let first = get_device_id().expect("device id");
        assert!(!first.is_empty());
        assert_eq!(get_device_id().expect("device id"), first);
        // The resolved ID is saved so a failing primary source can reuse it.
        assert_eq!(saved_device_id(), Some(first));
    }
}
