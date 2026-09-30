//! Parsers for the Linux checks (systemctl, lsblk, /proc/mounts, gsettings
//! and kreadconfig).
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use super::{clean_output, join_unique, plural_minutes, secs_to_minutes, CheckOutcome};
use serde_json::Value;

// ---------------------------------------------------------------- antivirus

/// Unit names from `systemctl list-units --type=service --state=running
/// --no-legend --plain`, without the `.service` suffix.
pub fn parse_systemctl_units(output: &str) -> Vec<String> {
    output
        .lines()
        .filter_map(|line| {
            let unit = line
                .split_whitespace()
                .find(|token| *token != "●" && *token != "*")?;
            Some(unit.strip_suffix(".service").unwrap_or(unit).to_string())
        })
        .collect()
}

/// Maps a running service to an antivirus product, by exact unit name.
pub fn linux_av_product(unit: &str) -> Option<&'static str> {
    match unit {
        "clamav-daemon" | "clamd" => Some("ClamAV"),
        u if u.starts_with("clamd@") => Some("ClamAV"),
        "esets" | "eea" | "efs" => Some("ESET"),
        "falcon-sensor" => Some("CrowdStrike Falcon"),
        "mdatp" => Some("Microsoft Defender"),
        "sentinelone" => Some("SentinelOne"),
        "sophos-spl" | "sav-protect" => Some("Sophos"),
        "bdsec" => Some("Bitdefender"),
        "ds_agent" => Some("Trend Micro Deep Security"),
        "cylancesvc" => Some("CylancePROTECT"),
        "avast" => Some("Avast"),
        _ => None,
    }
}

pub fn linux_antivirus_outcome(units: &[String]) -> CheckOutcome<String> {
    let products: Vec<&str> = units.iter().filter_map(|u| linux_av_product(u)).collect();
    if !products.is_empty() {
        let value = join_unique(products);
        return CheckOutcome::pass(value.clone(), format!("Running: {value}."));
    }
    if units.iter().any(|u| u == "clamav-freshclam") {
        return CheckOutcome::fail(
            "Only the ClamAV updater (freshclam) is running; no scanning daemon was found.",
        );
    }
    CheckOutcome::fail("No running antivirus service was found.")
}

// --------------------------------------------------------------- encryption

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MountDevice {
    pub mountpoint: String,
    /// True when the mounted device sits on a dm-crypt (LUKS) device
    pub encrypted: bool,
}

fn collect_mounts(node: &Value, under_crypt: bool, out: &mut Vec<MountDevice>) {
    let is_crypt = node.get("type").and_then(Value::as_str) == Some("crypt");
    let encrypted = under_crypt || is_crypt;

    let mut mountpoints: Vec<&str> = Vec::new();
    if let Some(mp) = node.get("mountpoint").and_then(Value::as_str) {
        mountpoints.push(mp);
    }
    if let Some(list) = node.get("mountpoints").and_then(Value::as_array) {
        mountpoints.extend(list.iter().filter_map(Value::as_str));
    }
    for mp in mountpoints {
        if !mp.is_empty() && !out.iter().any(|m| m.mountpoint == mp) {
            out.push(MountDevice {
                mountpoint: mp.to_string(),
                encrypted,
            });
        }
    }

    if let Some(children) = node.get("children").and_then(Value::as_array) {
        for child in children {
            collect_mounts(child, encrypted, out);
        }
    }
}

/// Parses `lsblk -J -o NAME,TYPE,MOUNTPOINT`: disk -> part -> crypt -> lvm.
/// Handles both the `mountpoint` string and newer `mountpoints` array.
pub fn parse_lsblk_mounts(json: &str) -> Result<Vec<MountDevice>, String> {
    let value: Value = serde_json::from_str(clean_output(json))
        .map_err(|e| format!("could not parse lsblk output: {e}"))?;
    let devices = value
        .get("blockdevices")
        .and_then(Value::as_array)
        .ok_or_else(|| "lsblk output has no block devices".to_string())?;
    let mut out = Vec::new();
    for device in devices {
        collect_mounts(device, false, &mut out);
    }
    Ok(out)
}

/// True when the home directory (or /home) is an eCryptfs mount.
pub fn home_on_ecryptfs(proc_mounts: &str, home: Option<&str>) -> bool {
    proc_mounts.lines().any(|line| {
        let mut fields = line.split_whitespace();
        let (_source, Some(mountpoint), Some(fstype)) = (fields.next(), fields.next(), fields.next())
        else {
            return false;
        };
        fstype == "ecryptfs"
            && (mountpoint == "/home"
                || home.is_some_and(|h| mountpoint == h.trim_end_matches('/')))
    })
}

pub fn linux_encryption_outcome(
    lsblk: Option<&str>,
    proc_mounts: Option<&str>,
    home: Option<&str>,
) -> Result<CheckOutcome<String>, String> {
    let mounts = match lsblk {
        Some(json) => Some(parse_lsblk_mounts(json)?),
        None => None,
    };
    let find = |mp: &str| {
        mounts
            .as_ref()
            .and_then(|m| m.iter().find(|d| d.mountpoint == mp))
    };

    if find("/").is_some_and(|d| d.encrypted) {
        return Ok(CheckOutcome::pass(
            "LUKS".to_string(),
            "The root filesystem (/) is on an encrypted dm-crypt/LUKS device.",
        ));
    }
    if find("/home").is_some_and(|d| d.encrypted) {
        return Ok(CheckOutcome::pass(
            "LUKS (/home)".to_string(),
            "/home is on an encrypted dm-crypt/LUKS device, but / is not.",
        ));
    }
    if proc_mounts.is_some_and(|m| home_on_ecryptfs(m, home)) {
        return Ok(CheckOutcome::pass(
            "eCryptfs".to_string(),
            "The home directory is encrypted with eCryptfs.",
        ));
    }

    match mounts {
        Some(mounts) if find("/").is_some() => {
            let others: Vec<&str> = mounts
                .iter()
                .filter(|m| m.encrypted)
                .map(|m| m.mountpoint.as_str())
                .collect();
            let mut detail = "The root filesystem (/) is not on an encrypted device.".to_string();
            if !others.is_empty() {
                detail.push_str(&format!(" Encrypted volumes found: {}.", others.join(", ")));
            }
            Ok(CheckOutcome::fail(detail))
        }
        Some(_) => Err("could not find the device that holds the root filesystem".to_string()),
        None => Err("could not list block devices with lsblk".to_string()),
    }
}

// -------------------------------------------------------------- screen lock

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinuxDesktop {
    Gnome,
    Cinnamon,
    Mate,
    Kde,
}

/// Picks the desktop from XDG_CURRENT_DESKTOP (a colon separated list such
/// as "ubuntu:GNOME"), then XDG_SESSION_DESKTOP, then DESKTOP_SESSION.
pub fn detect_linux_desktop(
    current_desktop: Option<&str>,
    session_desktop: Option<&str>,
    desktop_session: Option<&str>,
    gnome_session_installed: bool,
) -> Result<LinuxDesktop, String> {
    let names: Vec<String> = [current_desktop, session_desktop, desktop_session]
        .into_iter()
        .flatten()
        .flat_map(|v| v.split(':'))
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty())
        .collect();

    for name in &names {
        let desktop = match name.as_str() {
            "kde" | "plasma" | "plasmawayland" | "plasmax11" => Some(LinuxDesktop::Kde),
            "cinnamon" | "x-cinnamon" => Some(LinuxDesktop::Cinnamon),
            "mate" => Some(LinuxDesktop::Mate),
            n if n.starts_with("gnome")
                || n == "ubuntu"
                || n.starts_with("ubuntu-")
                || n == "unity"
                || n == "pop"
                || n == "budgie"
                || n.starts_with("budgie-") =>
            {
                Some(LinuxDesktop::Gnome)
            }
            _ => None,
        };
        if let Some(desktop) = desktop {
            return Ok(desktop);
        }
    }

    // e.g. a tiling window manager started from a GNOME installation
    if gnome_session_installed {
        return Ok(LinuxDesktop::Gnome);
    }
    match names.first() {
        Some(name) => Err(format!(
            "the screen lock check does not support the \"{name}\" desktop"
        )),
        None => Err("could not detect the desktop environment".to_string()),
    }
}

/// `gsettings get` prints booleans as "true"/"false".
pub fn parse_gsettings_bool(value: &str) -> Option<bool> {
    match value.trim() {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}

/// `gsettings get` prints numbers as "uint32 300", "int32 5" or "5".
pub fn parse_gsettings_uint(value: &str) -> Option<u32> {
    let value = value.trim();
    let number = value.rsplit(' ').next().unwrap_or(value);
    number.parse().ok()
}

/// `idle_secs` is the idle time before the screen blanks, and
/// `lock_delay_secs` the extra time before it locks.
pub fn gsettings_lock_outcome(
    lock_enabled: bool,
    idle_activation: Option<bool>,
    idle_secs: u32,
    lock_delay_secs: u32,
) -> CheckOutcome<u32> {
    if !lock_enabled {
        return CheckOutcome::fail("Automatic screen lock is turned off.");
    }
    if idle_activation == Some(false) || idle_secs == 0 {
        return CheckOutcome::fail(
            "The screen never blanks when idle (blank screen delay is \"Never\"), so it never locks on its own.",
        );
    }
    let minutes = secs_to_minutes(idle_secs.saturating_add(lock_delay_secs));
    CheckOutcome::pass(
        minutes,
        format!(
            "Locks after at most {} of inactivity (screen blanks after {}, locks {}).",
            plural_minutes(minutes),
            plural_minutes(secs_to_minutes(idle_secs)),
            if lock_delay_secs == 0 {
                "immediately".to_string()
            } else {
                format!("{lock_delay_secs} seconds later")
            }
        ),
    )
}

/// kscreenlockerrc `[Daemon]` values from kreadconfig; empty means default
/// (Autolock=true, Timeout=5 minutes, LockGrace=5 seconds).
pub fn kde_lock_outcome(autolock: &str, timeout_mins: &str, grace_secs: &str) -> Result<CheckOutcome<u32>, String> {
    let autolock = match autolock.trim() {
        "" => true,
        other => parse_gsettings_bool(other)
            .ok_or_else(|| format!("unexpected KDE Autolock value \"{other}\""))?,
    };
    let timeout = match timeout_mins.trim() {
        "" => 5,
        other => other
            .parse::<u32>()
            .map_err(|_| format!("unexpected KDE lock timeout \"{other}\""))?,
    };
    let grace = grace_secs.trim().parse::<u32>().unwrap_or(5);

    if !autolock {
        return Ok(CheckOutcome::fail("\"Lock screen automatically\" is turned off."));
    }
    if timeout == 0 {
        return Ok(CheckOutcome::fail("The automatic lock timeout is set to never."));
    }
    let minutes = timeout + secs_to_minutes(grace);
    Ok(CheckOutcome::pass(
        minutes,
        format!(
            "Locks after {} of inactivity (password required after a {grace} second grace period).",
            plural_minutes(timeout)
        ),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SYSTEMCTL: &str = "  accounts-daemon.service   loaded active running Accounts Service
  avahi-daemon.service      loaded active running Avahi mDNS/DNS-SD Stack
  clamav-freshclam.service  loaded active running ClamAV virus database updater
  savings.service           loaded active running Not an antivirus (contains 'avg' and 'sav')
  preset.service            loaded active running Contains 'eset'
";

    const LSBLK_LUKS_LVM: &str = r#"{
   "blockdevices": [
      {"name":"nvme0n1", "type":"disk", "mountpoint":null,
         "children": [
            {"name":"nvme0n1p1", "type":"part", "mountpoint":"/boot/efi"},
            {"name":"nvme0n1p2", "type":"part", "mountpoint":"/boot"},
            {"name":"nvme0n1p3", "type":"part", "mountpoint":null,
               "children": [
                  {"name":"luks-8a1f", "type":"crypt", "mountpoint":null,
                     "children": [
                        {"name":"vg-root", "type":"lvm", "mountpoint":"/"},
                        {"name":"vg-swap", "type":"lvm", "mountpoint":"[SWAP]"}
                     ]
                  }
               ]
            }
         ]
      }
   ]
}"#;

    const LSBLK_PLAIN_WITH_CRYPT_USB: &str = r#"{"blockdevices":[
      {"name":"sda","type":"disk","mountpoints":[null],"children":[
        {"name":"sda1","type":"part","mountpoints":["/boot/efi"]},
        {"name":"sda2","type":"part","mountpoints":["/home","/"]}
      ]},
      {"name":"sdb","type":"disk","mountpoints":[null],"children":[
        {"name":"sdb1","type":"part","mountpoints":[null],"children":[
          {"name":"backup","type":"crypt","mountpoints":["/mnt/backup"]}
        ]}
      ]}
    ]}"#;

    #[test]
    fn matches_antivirus_units_exactly() {
        let units = parse_systemctl_units(SYSTEMCTL);
        assert_eq!(units[0], "accounts-daemon");
        let outcome = linux_antivirus_outcome(&units);
        assert!(!outcome.compliant);
        assert!(outcome.detail.contains("freshclam"));

        let running = parse_systemctl_units(
            "● clamav-daemon.service loaded active running Clam AntiVirus userspace daemon\nmdatp.service loaded active running Microsoft Defender\nclamd@scan.service loaded active running clamd scanner\n",
        );
        let outcome = linux_antivirus_outcome(&running);
        assert!(outcome.compliant);
        assert_eq!(outcome.value.as_deref(), Some("ClamAV, Microsoft Defender"));

        assert!(!linux_antivirus_outcome(&parse_systemctl_units("")).compliant);
    }

    #[test]
    fn root_on_luks_is_encrypted() {
        let outcome = linux_encryption_outcome(Some(LSBLK_LUKS_LVM), None, None).unwrap();
        assert!(outcome.compliant);
        assert_eq!(outcome.value.as_deref(), Some("LUKS"));
    }

    #[test]
    fn encrypted_usb_disk_does_not_count() {
        let outcome = linux_encryption_outcome(Some(LSBLK_PLAIN_WITH_CRYPT_USB), Some(""), None).unwrap();
        assert!(!outcome.compliant);
        assert!(outcome.detail.contains("/mnt/backup"));
    }

    #[test]
    fn home_on_ecryptfs_counts() {
        let mounts = "/dev/sda2 / ext4 rw,relatime 0 0\n/home/.ecryptfs/ana/.Private /home/ana ecryptfs rw 0 0\n";
        let outcome =
            linux_encryption_outcome(Some(LSBLK_PLAIN_WITH_CRYPT_USB), Some(mounts), Some("/home/ana/"))
                .unwrap();
        assert!(outcome.compliant);
        assert_eq!(outcome.value.as_deref(), Some("eCryptfs"));
        // Some other user's eCryptfs mount is not ours
        assert!(!home_on_ecryptfs(mounts, Some("/home/bob")));
    }

    #[test]
    fn encryption_errors_when_nothing_is_readable() {
        assert!(linux_encryption_outcome(None, Some(""), None).is_err());
        assert!(linux_encryption_outcome(Some("{\"blockdevices\":[]}"), None, None).is_err());
        assert!(linux_encryption_outcome(Some("nope"), None, None).is_err());
    }

    #[test]
    fn detects_desktops() {
        use LinuxDesktop::*;
        assert_eq!(detect_linux_desktop(Some("ubuntu:GNOME"), None, None, false), Ok(Gnome));
        assert_eq!(detect_linux_desktop(Some("KDE"), None, None, false), Ok(Kde));
        assert_eq!(detect_linux_desktop(Some("X-Cinnamon"), None, None, false), Ok(Cinnamon));
        assert_eq!(detect_linux_desktop(None, Some("mate"), None, false), Ok(Mate));
        assert_eq!(detect_linux_desktop(Some("Unity"), None, None, false), Ok(Gnome));
        assert_eq!(detect_linux_desktop(Some("awesome"), None, None, true), Ok(Gnome));
        assert!(detect_linux_desktop(Some("awesome"), None, None, false)
            .unwrap_err()
            .contains("awesome"));
        assert!(detect_linux_desktop(None, None, None, false).is_err());
    }

    #[test]
    fn parses_gsettings_values() {
        assert_eq!(parse_gsettings_bool("true\n"), Some(true));
        assert_eq!(parse_gsettings_bool("false"), Some(false));
        assert_eq!(parse_gsettings_bool("No such key"), None);
        assert_eq!(parse_gsettings_uint("uint32 300\n"), Some(300));
        assert_eq!(parse_gsettings_uint("5"), Some(5));
        assert_eq!(parse_gsettings_uint("int32 7"), Some(7));
        assert_eq!(parse_gsettings_uint(""), None);
    }

    #[test]
    fn gnome_idle_delay_zero_is_never() {
        assert!(!gsettings_lock_outcome(true, None, 0, 0).compliant);
        assert!(!gsettings_lock_outcome(false, None, 300, 0).compliant);
        assert!(!gsettings_lock_outcome(true, Some(false), 300, 0).compliant);
        let outcome = gsettings_lock_outcome(true, None, 300, 30);
        assert!(outcome.compliant);
        assert_eq!(outcome.value, Some(6));
    }

    #[test]
    fn kde_uses_defaults_for_missing_keys() {
        assert_eq!(kde_lock_outcome("", "", "").unwrap().value, Some(6));
        assert_eq!(kde_lock_outcome("true", "10", "0").unwrap().value, Some(10));
        assert!(!kde_lock_outcome("false", "10", "").unwrap().compliant);
        assert!(!kde_lock_outcome("true", "0", "").unwrap().compliant);
        assert!(kde_lock_outcome("maybe", "", "").is_err());
    }
}
