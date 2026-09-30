//! Parsers for the Windows checks. The probes run PowerShell with
//! `ConvertTo-Json`, so everything here is locale independent: only JSON
//! keys, registry values and `0x` hex indexes are read, never localized text.
#![cfg_attr(not(target_os = "windows"), allow(dead_code))]

use super::{clean_output, join_unique, plural_minutes, secs_to_minutes, CheckOutcome};
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------- antivirus

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AvProduct {
    pub name: String,
    pub product_state: Option<u32>,
}

/// Real-time protection is on when the scanner nibble of productState is 1
/// (e.g. 0x061100 = 397568 is on, 0x060100 = 393472 is off).
pub fn av_product_enabled(state: u32) -> bool {
    (state >> 12) & 0xF == 1
}

/// The low byte is 0x00 when definitions are up to date and 0x10 when not.
pub fn av_definitions_outdated(state: u32) -> bool {
    (state >> 4) & 0xF != 0
}

fn json_u32(value: &Value) -> Option<u32> {
    match value {
        Value::Number(n) => n.as_u64().and_then(|n| u32::try_from(n).ok()),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

fn json_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

/// `Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct
/// | Select-Object displayName,productState | ConvertTo-Json`: an array, a
/// single object, or nothing at all when no product is registered.
pub fn parse_windows_av_json(json: &str) -> Result<Vec<AvProduct>, String> {
    let json = clean_output(json);
    if json.is_empty() {
        return Ok(Vec::new());
    }
    let value: Value = serde_json::from_str(json)
        .map_err(|e| format!("could not parse the Windows Security Center output: {e}"))?;
    let items = match value {
        Value::Array(items) => items,
        Value::Null => Vec::new(),
        other => vec![other],
    };
    Ok(items
        .iter()
        .filter_map(|item| {
            let name = item.get("displayName").and_then(json_string)?;
            let product_state = item.get("productState").and_then(json_u32);
            Some(AvProduct { name, product_state })
        })
        .collect())
}

pub fn windows_antivirus_outcome(products: &[AvProduct]) -> CheckOutcome<String> {
    if products.is_empty() {
        return CheckOutcome::fail("No antivirus is registered with Windows Security Center.");
    }
    let enabled: Vec<&AvProduct> = products
        .iter()
        .filter(|p| p.product_state.is_some_and(av_product_enabled))
        .collect();

    if enabled.is_empty() {
        return CheckOutcome::fail(format!(
            "Installed but real-time protection is off: {}.",
            join_unique(products.iter().map(|p| p.name.as_str()))
        ));
    }

    let value = join_unique(enabled.iter().map(|p| p.name.as_str()));
    let outdated: Vec<&str> = enabled
        .iter()
        .filter(|p| p.product_state.is_some_and(av_definitions_outdated))
        .map(|p| p.name.as_str())
        .collect();
    let mut detail = format!("Real-time protection is on: {value}.");
    if !outdated.is_empty() {
        detail.push_str(&format!(
            " Virus definitions are out of date for {}.",
            join_unique(outdated)
        ));
    }
    CheckOutcome::pass(value, detail)
}

// --------------------------------------------------------------- encryption

/// Output of the BitLocker probe script, see `security::windows`.
#[derive(Debug, Default, Deserialize)]
pub struct BitLockerInfo {
    #[serde(rename = "Drive")]
    pub drive: Option<String>,
    /// `System.Volume.BitLockerProtection` from the Shell (no admin needed)
    #[serde(rename = "Shell")]
    pub shell: Option<Value>,
    /// Win32_EncryptableVolume.ProtectionStatus (only readable as admin)
    #[serde(rename = "CimProtection")]
    pub cim_protection: Option<Value>,
    /// Win32_EncryptableVolume.ConversionStatus (only readable as admin)
    #[serde(rename = "CimConversion")]
    pub cim_conversion: Option<Value>,
}

pub fn parse_bitlocker_json(json: &str) -> Result<BitLockerInfo, String> {
    serde_json::from_str(clean_output(json))
        .map_err(|e| format!("could not parse the BitLocker status: {e}"))
}

pub fn windows_encryption_outcome(info: &BitLockerInfo) -> Result<CheckOutcome<String>, String> {
    let drive = info
        .drive
        .as_deref()
        .map(str::trim)
        .filter(|d| !d.is_empty())
        .unwrap_or("C:");

    let protection = info.cim_protection.as_ref().and_then(json_u32);
    let conversion = info.cim_conversion.as_ref().and_then(json_u32);
    // ProtectionStatus: 0 off, 1 on, 2 unknown. ConversionStatus: 0 decrypted,
    // 1 encrypted, 2 encrypting, 3 decrypting, 4 encryption paused, 5 decryption paused
    match (protection, conversion) {
        (Some(1), Some(2)) => {
            return Ok(CheckOutcome::pass(
                "BitLocker".to_string(),
                format!("BitLocker is on for {drive}; encryption is still in progress."),
            ))
        }
        (Some(1), _) => {
            return Ok(CheckOutcome::pass(
                "BitLocker".to_string(),
                format!("BitLocker protection is on for {drive}."),
            ))
        }
        (Some(0), Some(2)) => {
            return Ok(CheckOutcome::pass(
                "BitLocker".to_string(),
                format!("BitLocker is encrypting {drive}."),
            ))
        }
        (Some(0), Some(1 | 4)) => {
            return Ok(CheckOutcome::fail(format!(
                "BitLocker is suspended on {drive}: the drive is encrypted but protection is off."
            )))
        }
        (Some(0), _) => {
            return Ok(CheckOutcome::fail(format!("BitLocker is off for {drive}.")))
        }
        _ => {}
    }

    // System.Volume.BitLockerProtection: 0 not encryptable, 1 on, 2 off,
    // 3 encrypting, 4 decrypting, 5 suspended, 6 on (locked), 7 on (used space)
    match info.shell.as_ref().and_then(json_u32) {
        Some(1 | 6) => Ok(CheckOutcome::pass(
            "BitLocker".to_string(),
            format!("BitLocker protection is on for {drive}."),
        )),
        Some(3) => Ok(CheckOutcome::pass(
            "BitLocker".to_string(),
            format!("BitLocker is encrypting {drive}."),
        )),
        Some(7) => Ok(CheckOutcome::pass(
            "BitLocker (used space only)".to_string(),
            format!("BitLocker is on for {drive} (only used space is encrypted)."),
        )),
        Some(2) => Ok(CheckOutcome::fail(format!("BitLocker is off for {drive}."))),
        Some(4) => Ok(CheckOutcome::fail(format!(
            "BitLocker is being turned off; {drive} is decrypting."
        ))),
        Some(5) => Ok(CheckOutcome::fail(format!(
            "BitLocker is suspended on {drive}: the drive is encrypted but protection is off."
        ))),
        Some(0) => Ok(CheckOutcome::fail(format!(
            "BitLocker is not available for {drive} on this device or Windows edition."
        ))),
        Some(other) => Err(format!("unknown BitLocker status {other} for {drive}")),
        None => Err(format!("could not read the BitLocker status of {drive}")),
    }
}

// -------------------------------------------------------------- screen lock

/// Output of the screen lock probe script, see `security::windows`.
/// Registry values arrive as strings (or null when not set).
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct WindowsLockInfo {
    /// Raw `powercfg /q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE` output
    pub video_idle: Option<String>,
    /// Raw `powercfg /q SCHEME_CURRENT SUB_NONE CONSOLELOCK` output
    pub console_lock: Option<String>,
    pub screen_save_active: Option<Value>,
    pub screen_saver_is_secure: Option<Value>,
    pub screen_save_time_out: Option<Value>,
    pub screen_saver_exe: Option<Value>,
    pub policy_screen_save_active: Option<Value>,
    pub policy_screen_saver_is_secure: Option<Value>,
    pub policy_screen_save_time_out: Option<Value>,
    pub policy_screen_saver_exe: Option<Value>,
    pub inactivity_timeout_secs: Option<Value>,
    pub has_battery: Option<bool>,
}

pub fn parse_windows_lock_json(json: &str) -> Result<WindowsLockInfo, String> {
    serde_json::from_str(clean_output(json))
        .map_err(|e| format!("could not parse the screen lock settings: {e}"))
}

/// The (AC, DC) "current power setting index" values of a single
/// `powercfg /q` setting. The labels are localized, so only the `0x` values
/// are read: minimum, maximum and increment come first, AC and DC last.
pub fn parse_powercfg_indexes(text: &str) -> Option<(u32, u32)> {
    let values: Vec<u32> = text
        .lines()
        .filter_map(|line| {
            let start = line.rfind("0x").or_else(|| line.rfind("0X"))?;
            let digits: String = line[start + 2..]
                .chars()
                .take_while(|c| c.is_ascii_hexdigit())
                .collect();
            if digits.is_empty() {
                return None;
            }
            u32::from_str_radix(&digits, 16).ok()
        })
        .collect();
    match values.as_slice() {
        [.., ac, dc] => Some((*ac, *dc)),
        _ => None,
    }
}

fn pick_value<'a>(policy: &'a Option<Value>, user: &'a Option<Value>) -> Option<&'a Value> {
    policy
        .as_ref()
        .filter(|v| !v.is_null())
        .or(user.as_ref().filter(|v| !v.is_null()))
}

fn is_one(value: Option<&Value>) -> bool {
    value.and_then(json_u32) == Some(1)
}

/// Seconds until the password-protected screen saver starts, if one is set.
fn secure_screensaver_secs(info: &WindowsLockInfo) -> Option<u32> {
    let active = is_one(pick_value(&info.policy_screen_save_active, &info.screen_save_active));
    let secure = is_one(pick_value(&info.policy_screen_saver_is_secure, &info.screen_saver_is_secure));
    let exe = pick_value(&info.policy_screen_saver_exe, &info.screen_saver_exe).and_then(json_string);
    let timeout = pick_value(&info.policy_screen_save_time_out, &info.screen_save_time_out)
        .and_then(json_u32)
        .filter(|&t| t > 0);
    if active && secure && exe.is_some() {
        timeout
    } else {
        None
    }
}

pub fn windows_screen_lock_outcome(info: &WindowsLockInfo) -> Result<CheckOutcome<u32>, String> {
    let inactivity = info
        .inactivity_timeout_secs
        .as_ref()
        .and_then(json_u32)
        .filter(|&t| t > 0);
    let screensaver = secure_screensaver_secs(info);
    let video = info.video_idle.as_deref().and_then(parse_powercfg_indexes);
    // "Require a password on wakeup"; assume on when it cannot be read
    let console_lock = info.console_lock.as_deref().and_then(parse_powercfg_indexes);

    if video.is_none() && inactivity.is_none() && screensaver.is_none() {
        return Err("could not read the display timeout from powercfg".to_string());
    }

    let has_battery = info.has_battery.unwrap_or(false);
    let sources: &[(&str, usize)] = if has_battery {
        &[("plugged in", 0), ("on battery", 1)]
    } else {
        &[("plugged in", 0)]
    };

    let mut worst = 0;
    let mut display_notes = Vec::new();
    for &(label, index) in sources {
        let lock_on_wake = console_lock
            .map(|(ac, dc)| if index == 0 { ac } else { dc } != 0)
            .unwrap_or(true);
        let display = video
            .map(|(ac, dc)| if index == 0 { ac } else { dc })
            .filter(|&secs| secs > 0 && lock_on_wake);
        if let Some(secs) = display {
            display_notes.push(format!("{} {label}", plural_minutes(secs_to_minutes(secs))));
        }
        let trigger = [inactivity, screensaver, display].into_iter().flatten().min();
        match trigger {
            Some(secs) => worst = worst.max(secs),
            None => {
                return Ok(CheckOutcome::fail(format!(
                    "The screen never locks on its own {label}: the display never turns off (or no password is required on wake), and there is no password-protected screen saver or inactivity limit."
                )))
            }
        }
    }

    let minutes = secs_to_minutes(worst);
    let mut mechanisms = Vec::new();
    if let Some(secs) = inactivity {
        mechanisms.push(format!(
            "machine inactivity limit {}",
            plural_minutes(secs_to_minutes(secs))
        ));
    }
    if let Some(secs) = screensaver {
        mechanisms.push(format!(
            "password-protected screen saver after {}",
            plural_minutes(secs_to_minutes(secs))
        ));
    }
    if !display_notes.is_empty() {
        mechanisms.push(format!("display turns off after {}", display_notes.join(", ")));
    }
    Ok(CheckOutcome::pass(
        minutes,
        format!(
            "Locks after at most {} of inactivity ({}).",
            plural_minutes(minutes),
            mechanisms.join("; ")
        ),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const POWERCFG_EN: &str = "Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)\r
  Subgroup GUID: 7516b95f-f776-4464-8c53-06167f40cc99  (Display)\r
    Power Setting GUID: 3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e  (Turn off display after)\r
      Minimum Possible Setting: 0x00000000\r
      Maximum Possible Setting: 0xffffffff\r
      Possible Settings increment: 0x00000001\r
      Possible Settings units: Seconds\r
    Current AC Power Setting Index: 0x00000258\r
    Current DC Power Setting Index: 0x0000012c\r
";

    const POWERCFG_ES: &str = "GUID del esquema de energía: 381b4222-f694-41f0-9685-ff5bb260df2e  (Equilibrado)
  GUID del subgrupo: 7516b95f-f776-4464-8c53-06167f40cc99  (Pantalla)
    GUID de la configuración de energía: 3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e  (Apagar la pantalla tras)
      Configuración mínima posible: 0x00000000
      Configuración máxima posible: 0xffffffff
      Incremento de configuración posible: 0x00000001
      Unidades de configuración posibles: Segundos
    Índice de configuración de corriente alterna actual: 0x00000384
    Índice de configuración de corriente continua actual: 0x00000000
";

    const CONSOLELOCK_ON: &str = "    Power Setting GUID: 0e796bdb-100d-47d6-a2d5-f7d2daa51f51  (Require a password on wakeup)
      Possible Setting Index: 000
      Possible Setting Friendly Name: No
      Possible Setting Index: 001
      Possible Setting Friendly Name: Yes
    Current AC Power Setting Index: 0x00000001
    Current DC Power Setting Index: 0x00000001
";

    #[test]
    fn decodes_security_center_product_state() {
        assert!(av_product_enabled(397568)); // 0x061100 Defender on, up to date
        assert!(!av_product_enabled(393472)); // 0x060100 Defender off
        assert!(av_product_enabled(397584)); // 0x061110 on, outdated
        assert!(av_definitions_outdated(397584));
        assert!(!av_definitions_outdated(397568));
        assert!(av_product_enabled(266240)); // 0x041000 third-party on
    }

    #[test]
    fn parses_security_center_json_array_object_and_empty() {
        let array = r#"[{"displayName":"Windows Defender","productState":393472},{"displayName":"ESET Security","productState":266240}]"#;
        let products = parse_windows_av_json(array).unwrap();
        assert_eq!(products.len(), 2);
        let outcome = windows_antivirus_outcome(&products);
        assert!(outcome.compliant);
        assert_eq!(outcome.value.as_deref(), Some("ESET Security"));

        let single = "\u{feff}{\"displayName\":\"Windows Defender\",\"productState\":397584}\r\n";
        let products = parse_windows_av_json(single).unwrap();
        let outcome = windows_antivirus_outcome(&products);
        assert!(outcome.compliant);
        assert!(outcome.detail.contains("out of date"));

        let off = parse_windows_av_json(r#"[{"displayName":"Windows Defender","productState":393472}]"#).unwrap();
        let outcome = windows_antivirus_outcome(&off);
        assert!(!outcome.compliant);
        assert!(outcome.detail.contains("real-time protection is off"));

        assert!(parse_windows_av_json("").unwrap().is_empty());
        assert!(parse_windows_av_json("[]").unwrap().is_empty());
        assert!(!windows_antivirus_outcome(&[]).compliant);
        assert!(parse_windows_av_json("not json").is_err());
    }

    #[test]
    fn decides_bitlocker_from_cim_then_shell() {
        let parse = |json: &str| windows_encryption_outcome(&parse_bitlocker_json(json).unwrap());

        let cim_on = parse(r#"{"Drive":"D:","Shell":null,"CimProtection":1,"CimConversion":1}"#).unwrap();
        assert!(cim_on.compliant);
        assert!(cim_on.detail.contains("D:"));

        let suspended = parse(r#"{"Drive":"C:","Shell":5,"CimProtection":0,"CimConversion":1}"#).unwrap();
        assert!(!suspended.compliant);
        assert!(suspended.detail.contains("suspended"));

        for on in ["1", "3", "6", "\"7\""] {
            let json = format!(r#"{{"Drive":"C:","Shell":{on},"CimProtection":null,"CimConversion":null}}"#);
            assert!(parse(&json).unwrap().compliant, "shell value {on}");
        }
        for off in ["0", "2", "4", "5"] {
            let json = format!(r#"{{"Drive":"C:","Shell":{off}}}"#);
            assert!(!parse(&json).unwrap().compliant, "shell value {off}");
        }
        assert!(parse(r#"{"Drive":"C:","Shell":null}"#).is_err());
        assert!(parse(r#"{"Drive":"C:","Shell":42}"#).is_err());
    }

    #[test]
    fn parses_powercfg_in_any_locale() {
        assert_eq!(parse_powercfg_indexes(POWERCFG_EN), Some((600, 300)));
        assert_eq!(parse_powercfg_indexes(POWERCFG_ES), Some((900, 0)));
        assert_eq!(parse_powercfg_indexes(CONSOLELOCK_ON), Some((1, 1)));
        // Full-width colon, as in some East Asian locales
        assert_eq!(
            parse_powercfg_indexes("当前交流电源设置索引：0x0000003c\n当前直流电源设置索引：0x0000001e\n"),
            Some((60, 30))
        );
        assert_eq!(parse_powercfg_indexes("The system cannot find the file specified."), None);
    }

    fn lock_info(json: &str) -> WindowsLockInfo {
        parse_windows_lock_json(json).unwrap()
    }

    #[test]
    fn windows_screen_lock_uses_display_timeout_per_power_source() {
        let desktop = WindowsLockInfo {
            video_idle: Some(POWERCFG_EN.to_string()),
            console_lock: Some(CONSOLELOCK_ON.to_string()),
            has_battery: Some(false),
            ..Default::default()
        };
        let outcome = windows_screen_lock_outcome(&desktop).unwrap();
        assert_eq!(outcome.value, Some(10));

        let laptop = WindowsLockInfo { has_battery: Some(true), ..desktop };
        // DC 5 minutes, AC 10 minutes: the worst case is 10
        assert_eq!(windows_screen_lock_outcome(&laptop).unwrap().value, Some(10));

        // Display never turns off on battery and there is nothing else
        let never = WindowsLockInfo {
            video_idle: Some(POWERCFG_ES.to_string()),
            has_battery: Some(true),
            ..Default::default()
        };
        let outcome = windows_screen_lock_outcome(&never).unwrap();
        assert!(!outcome.compliant);
        assert!(outcome.detail.contains("on battery"));
    }

    #[test]
    fn windows_screen_lock_uses_screen_saver_and_policy() {
        let info = lock_info(
            r#"{"VideoIdle":null,"ConsoleLock":null,"ScreenSaveActive":"1","ScreenSaverIsSecure":"1","ScreenSaveTimeOut":"300","ScreenSaverExe":"C:\\Windows\\system32\\scrnsave.scr","PolicyScreenSaveActive":null,"PolicyScreenSaverIsSecure":null,"PolicyScreenSaveTimeOut":null,"PolicyScreenSaverExe":null,"InactivityTimeoutSecs":null,"HasBattery":false}"#,
        );
        let outcome = windows_screen_lock_outcome(&info).unwrap();
        assert!(outcome.compliant);
        assert_eq!(outcome.value, Some(5));

        // Not password protected: does not count, and nothing else is readable
        let insecure = lock_info(
            r#"{"ScreenSaveActive":"1","ScreenSaverIsSecure":"0","ScreenSaveTimeOut":"300","ScreenSaverExe":"x.scr","HasBattery":false}"#,
        );
        assert!(windows_screen_lock_outcome(&insecure).is_err());

        // Group policy timeout wins over the user's value; the inactivity limit is lower still
        let policy = lock_info(
            r#"{"ScreenSaveActive":"1","ScreenSaverIsSecure":"1","ScreenSaveTimeOut":"3600","ScreenSaverExe":"x.scr","PolicyScreenSaveTimeOut":"900","InactivityTimeoutSecs":"600","HasBattery":false}"#,
        );
        assert_eq!(windows_screen_lock_outcome(&policy).unwrap().value, Some(10));
    }

    #[test]
    fn display_off_does_not_count_without_password_on_wake() {
        let info = WindowsLockInfo {
            video_idle: Some(POWERCFG_EN.to_string()),
            console_lock: Some(
                "Current AC Power Setting Index: 0x00000000\nCurrent DC Power Setting Index: 0x00000000\n"
                    .to_string(),
            ),
            has_battery: Some(false),
            ..Default::default()
        };
        assert!(!windows_screen_lock_outcome(&info).unwrap().compliant);
    }
}
