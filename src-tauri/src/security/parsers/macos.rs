//! Parsers for the macOS checks (sysadminctl, pmset, diskutil, fdesetup,
//! spctl and ps).
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use super::{join_unique, plural_minutes, CheckOutcome};
use std::collections::HashSet;

// ---------------------------------------------------------------- antivirus

/// A third-party antivirus / EDR product, detected by its running agent or,
/// failing that, by its install location.
pub struct MacAvProduct {
    pub name: &'static str,
    pub paths: &'static [&'static str],
    pub processes: &'static [&'static str],
}

pub const MAC_AV_PRODUCTS: &[MacAvProduct] = &[
    MacAvProduct {
        name: "CrowdStrike Falcon",
        paths: &["/Applications/Falcon.app", "/Library/CS/falcond"],
        processes: &["falcond", "com.crowdstrike.falcon.Agent"],
    },
    MacAvProduct {
        name: "Microsoft Defender",
        paths: &[
            "/Applications/Microsoft Defender.app",
            "/Library/Application Support/Microsoft/Defender",
        ],
        processes: &["wdavdaemon", "wdavdaemon_enterprise", "wdavdaemon_unprivileged"],
    },
    MacAvProduct {
        name: "SentinelOne",
        paths: &["/Library/Sentinel", "/Applications/SentinelOne"],
        processes: &["SentinelAgent", "sentineld"],
    },
    MacAvProduct {
        name: "Sophos",
        paths: &["/Applications/Sophos", "/Library/Sophos Anti-Virus"],
        processes: &["SophosScanD", "SophosAntiVirus", "com.sophos.endpoint.scanextension"],
    },
    MacAvProduct {
        name: "Jamf Protect",
        paths: &["/Applications/JamfProtect.app"],
        processes: &["JamfProtect", "com.jamf.protect.daemon"],
    },
    MacAvProduct {
        name: "Bitdefender",
        paths: &["/Library/Bitdefender", "/Applications/Bitdefender"],
        processes: &["BDLDaemon"],
    },
    MacAvProduct {
        name: "Malwarebytes",
        paths: &["/Applications/Malwarebytes.app"],
        processes: &["RTProtectionDaemon"],
    },
    MacAvProduct {
        name: "ESET",
        paths: &[
            "/Applications/ESET Endpoint Security.app",
            "/Applications/ESET Endpoint Antivirus.app",
            "/Applications/ESET Cyber Security.app",
        ],
        processes: &["esets_daemon"],
    },
];

/// Executable names from `ps -axo comm=`, which prints full paths on macOS.
pub fn parse_process_names(ps: &str) -> HashSet<String> {
    ps.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| line.rsplit('/').next().unwrap_or(line).to_string())
        .collect()
}

/// `spctl --status` prints "assessments enabled" or "assessments disabled".
pub fn parse_gatekeeper_status(spctl: &str) -> Option<bool> {
    let text = spctl.to_lowercase();
    if text.contains("assessments enabled") {
        Some(true)
    } else if text.contains("assessments disabled") {
        Some(false)
    } else {
        None
    }
}

/// A third-party product (running or installed) always counts. XProtect is
/// always present on macOS, so on its own it only counts when Gatekeeper is
/// also enabled, and the result is labelled as built-in protection.
pub fn macos_antivirus_outcome(
    running: &[&str],
    installed: &[&str],
    xprotect_present: bool,
    xprotect_version: Option<&str>,
    gatekeeper: Option<bool>,
) -> CheckOutcome<String> {
    if !running.is_empty() || !installed.is_empty() {
        let value = join_unique(running.iter().chain(installed).copied());
        let mut parts = Vec::new();
        if !running.is_empty() {
            parts.push(format!("Running: {}.", join_unique(running.iter().copied())));
        }
        if !installed.is_empty() {
            parts.push(format!(
                "Installed, but its agent was not seen running: {}.",
                join_unique(installed.iter().copied())
            ));
        }
        return CheckOutcome::pass(value, parts.join(" "));
    }

    let xprotect = match xprotect_version {
        Some(version) => format!("XProtect {version}"),
        None => "XProtect".to_string(),
    };

    match (xprotect_present, gatekeeper) {
        (true, Some(true)) => CheckOutcome::pass(
            format!("{xprotect} (built-in)"),
            format!(
                "No third-party antivirus detected. Relying on built-in macOS protection: {xprotect} with Gatekeeper enabled."
            ),
        ),
        (true, Some(false)) => CheckOutcome::fail(format!(
            "No third-party antivirus detected, and Gatekeeper is disabled, so built-in protection ({xprotect}) does not count."
        )),
        (true, None) => CheckOutcome::fail(format!(
            "No third-party antivirus detected, and the Gatekeeper status could not be confirmed, so built-in protection ({xprotect}) does not count."
        )),
        (false, _) => CheckOutcome::fail(
            "No antivirus detected: no third-party product was found and XProtect is missing.",
        ),
    }
}

// --------------------------------------------------------------- encryption

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileVault {
    On,
    Off,
    Encrypting,
    Decrypting,
}

/// diskutil pads its columns, e.g. "   FileVault:                 Yes"
pub fn filevault_from_diskutil(diskutil_info: &str) -> Option<FileVault> {
    diskutil_info.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        if key.trim() != "FileVault" {
            return None;
        }
        let value = value.trim();
        if value.starts_with("Yes") {
            Some(FileVault::On)
        } else if value.starts_with("No") {
            Some(FileVault::Off)
        } else {
            None
        }
    })
}

/// `fdesetup status`, e.g. "FileVault is On." or "Encryption in progress: ..."
pub fn filevault_from_fdesetup(status: &str) -> Option<FileVault> {
    if status.contains("Encryption in progress") {
        Some(FileVault::Encrypting)
    } else if status.contains("Decryption in progress") {
        Some(FileVault::Decrypting)
    } else if status.contains("FileVault is On") {
        Some(FileVault::On)
    } else if status.contains("FileVault is Off") {
        Some(FileVault::Off)
    } else {
        None
    }
}

pub fn filevault_outcome(status: FileVault) -> CheckOutcome<String> {
    match status {
        FileVault::On => CheckOutcome::pass(
            "FileVault".to_string(),
            "FileVault is on for the startup disk.",
        ),
        FileVault::Encrypting => CheckOutcome::pass(
            "FileVault".to_string(),
            "FileVault is on; the startup disk is still being encrypted.",
        ),
        FileVault::Off => CheckOutcome::fail("FileVault is off for the startup disk."),
        FileVault::Decrypting => {
            CheckOutcome::fail("FileVault is being turned off; the startup disk is decrypting.")
        }
    }
}

// -------------------------------------------------------------- screen lock

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacLockDelay {
    /// "Require password after sleep or screen saver begins" is off
    Off,
    /// Seconds between the screen saver/display sleep starting and the lock
    Seconds(u32),
}

/// Parses `sysadminctl -screenLock status`, which writes to stderr.
pub fn parse_screen_lock_delay(status: &str) -> Option<MacLockDelay> {
    if status.contains("screenLock is off") {
        return Some(MacLockDelay::Off);
    }
    if status.contains("screenLock delay is immediate") {
        return Some(MacLockDelay::Seconds(0));
    }

    let caps = regex::Regex::new(r"screenLock delay is (\d+) seconds")
        .ok()?
        .captures(status)?;
    caps.get(1)?
        .as_str()
        .parse::<u32>()
        .ok()
        .map(MacLockDelay::Seconds)
}

/// Display sleep in minutes for each power source (AC, battery, UPS) in `pmset -g custom`
pub fn parse_display_sleep(pmset: &str) -> Vec<u32> {
    pmset
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            match parts.next() {
                Some("displaysleep") => parts.next()?.parse::<u32>().ok(),
                _ => None,
            }
        })
        .collect()
}

/// Worst case, across power sources, of idle minutes until the screen locks.
/// A value of 0 means "never" for both the screen saver and display sleep.
pub fn idle_to_lock_minutes(
    screensaver_secs: Option<u32>,
    display_sleep_mins: &[u32],
    lock_delay_secs: u32,
) -> Option<u32> {
    let screensaver_mins = screensaver_secs.filter(|&s| s > 0).map(|s| s.div_ceil(60));
    let sources: &[u32] = if display_sleep_mins.is_empty() { &[0] } else { display_sleep_mins };

    let mut worst = 0;
    for &display_mins in sources {
        let display_mins = Some(display_mins).filter(|&d| d > 0);
        // The screen locks at whichever idle trigger fires first
        let trigger = match (screensaver_mins, display_mins) {
            (Some(s), Some(d)) => s.min(d),
            (Some(t), None) | (None, Some(t)) => t,
            (None, None) => return None,
        };
        worst = worst.max(trigger);
    }

    Some(worst + lock_delay_secs.div_ceil(60))
}

pub fn macos_screen_lock_outcome(
    sysadminctl_status: &str,
    screensaver_secs: Option<u32>,
    pmset: &str,
) -> Result<CheckOutcome<u32>, String> {
    let delay = parse_screen_lock_delay(sysadminctl_status)
        .ok_or_else(|| "could not read the screen lock setting from sysadminctl".to_string())?;

    let lock_delay_secs = match delay {
        MacLockDelay::Off => {
            return Ok(CheckOutcome::fail(
                "\"Require password after screen saver begins or display is turned off\" is off.",
            ))
        }
        MacLockDelay::Seconds(secs) => secs,
    };

    let display_sleep = parse_display_sleep(pmset);
    match idle_to_lock_minutes(screensaver_secs, &display_sleep, lock_delay_secs) {
        None => Ok(CheckOutcome::fail(
            "The screen never locks on its own: on at least one power source the display never sleeps and no screen saver is set.",
        )),
        Some(minutes) => {
            let password = if lock_delay_secs == 0 {
                "a password is required immediately".to_string()
            } else {
                format!("a password is required after {lock_delay_secs} seconds")
            };
            Ok(CheckOutcome::pass(
                minutes,
                format!(
                    "Locks after at most {} of inactivity ({password}).",
                    plural_minutes(minutes)
                ),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PMSET_LAPTOP: &str = "Battery Power:\n displaysleep         2\n sleep                1\nAC Power:\n displaysleep         10\n sleep                1\n";
    const LOG: &str = "2026-09-30 12:11:25.993 sysadminctl[1894:34196] ";

    #[test]
    fn detects_filevault_from_padded_diskutil_output() {
        assert_eq!(
            filevault_from_diskutil("   Encrypted:                 Yes\n   FileVault:                 Yes\n"),
            Some(FileVault::On)
        );
        assert_eq!(
            filevault_from_diskutil("   FileVault:                 No\n"),
            Some(FileVault::Off)
        );
        assert_eq!(filevault_from_diskutil(""), None);
    }

    #[test]
    fn parses_fdesetup_status() {
        assert_eq!(filevault_from_fdesetup("FileVault is On.\n"), Some(FileVault::On));
        assert_eq!(filevault_from_fdesetup("FileVault is Off.\n"), Some(FileVault::Off));
        assert_eq!(
            filevault_from_fdesetup("FileVault is On.\nEncryption in progress: Percent completed = 12.3\n"),
            Some(FileVault::Encrypting)
        );
        assert_eq!(filevault_from_fdesetup("garbage"), None);
        assert!(filevault_outcome(FileVault::Encrypting).compliant);
        assert!(!filevault_outcome(FileVault::Off).compliant);
    }

    #[test]
    fn parses_screen_lock_delay_from_sysadminctl() {
        assert_eq!(
            parse_screen_lock_delay(&format!("{LOG}screenLock delay is 300 seconds")),
            Some(MacLockDelay::Seconds(300))
        );
        assert_eq!(
            parse_screen_lock_delay(&format!("{LOG}screenLock delay is immediate")),
            Some(MacLockDelay::Seconds(0))
        );
        assert_eq!(
            parse_screen_lock_delay(&format!("{LOG}screenLock is off")),
            Some(MacLockDelay::Off)
        );
        assert_eq!(parse_screen_lock_delay(""), None);
    }

    #[test]
    fn parses_display_sleep_per_power_source() {
        assert_eq!(parse_display_sleep(PMSET_LAPTOP), vec![2, 10]);
        assert_eq!(parse_display_sleep("AC Power:\n displaysleep         15\n"), vec![15]);
    }

    #[test]
    fn computes_worst_case_minutes_until_lock() {
        // No screen saver: AC display sleep (10) is the worst case, plus a 5 minute delay
        assert_eq!(idle_to_lock_minutes(None, &[2, 10], 300), Some(15));
        // Screen saver at 5 minutes fires before display sleep on AC
        assert_eq!(idle_to_lock_minutes(Some(300), &[2, 10], 0), Some(5));
        // Desktop Mac with only an AC power source
        assert_eq!(idle_to_lock_minutes(None, &[15], 0), Some(15));
        // Display never sleeps on AC and there is no screen saver
        assert_eq!(idle_to_lock_minutes(None, &[2, 0], 0), None);
        // Display never sleeps but the screen saver starts at 10 minutes
        assert_eq!(idle_to_lock_minutes(Some(600), &[0], 60), Some(11));
    }

    #[test]
    fn builds_screen_lock_outcomes() {
        let on = macos_screen_lock_outcome(
            &format!("{LOG}screenLock delay is immediate"),
            None,
            PMSET_LAPTOP,
        )
        .unwrap();
        assert!(on.compliant);
        assert_eq!(on.value, Some(10));

        let off =
            macos_screen_lock_outcome(&format!("{LOG}screenLock is off"), None, PMSET_LAPTOP)
                .unwrap();
        assert!(!off.compliant);
        assert_eq!(off.value, None);

        let never = macos_screen_lock_outcome(
            &format!("{LOG}screenLock delay is immediate"),
            None,
            "AC Power:\n displaysleep         0\n",
        )
        .unwrap();
        assert!(!never.compliant);

        assert!(macos_screen_lock_outcome("unexpected", None, PMSET_LAPTOP).is_err());
    }

    #[test]
    fn parses_ps_output_and_gatekeeper() {
        let ps = "/sbin/launchd\n/Library/CS/falcond\n/Applications/Microsoft Defender.app/Contents/MacOS/wdavdaemon\n  \n";
        let names = parse_process_names(ps);
        assert!(names.contains("falcond"));
        assert!(names.contains("wdavdaemon"));
        assert!(names.contains("launchd"));

        assert_eq!(parse_gatekeeper_status("assessments enabled\n"), Some(true));
        assert_eq!(parse_gatekeeper_status("assessments disabled\n"), Some(false));
        assert_eq!(parse_gatekeeper_status(""), None);
    }

    #[test]
    fn xprotect_alone_needs_gatekeeper_and_is_labelled() {
        let running = macos_antivirus_outcome(&["CrowdStrike Falcon"], &[], true, Some("5301"), Some(true));
        assert!(running.compliant);
        assert_eq!(running.value.as_deref(), Some("CrowdStrike Falcon"));

        let installed = macos_antivirus_outcome(&[], &["Malwarebytes"], true, None, Some(false));
        assert!(installed.compliant);
        assert!(installed.detail.contains("not seen running"));

        let builtin = macos_antivirus_outcome(&[], &[], true, Some("5301"), Some(true));
        assert!(builtin.compliant);
        assert_eq!(builtin.value.as_deref(), Some("XProtect 5301 (built-in)"));
        assert!(builtin.detail.contains("No third-party antivirus"));

        assert!(!macos_antivirus_outcome(&[], &[], true, Some("5301"), Some(false)).compliant);
        assert!(!macos_antivirus_outcome(&[], &[], true, None, None).compliant);
        assert!(!macos_antivirus_outcome(&[], &[], false, None, Some(true)).compliant);
    }
}
