//! Linux probes: collect command output and hand it to `parsers::linux`.

use super::parsers::linux::{self as p, LinuxDesktop};
use super::parsers::CheckOutcome;
use super::runner::run_ok;
use std::path::Path;

pub fn antivirus() -> Result<CheckOutcome<String>, String> {
    let output = run_ok(
        "systemctl",
        &[
            "list-units",
            "--type=service",
            "--state=running",
            "--no-legend",
            "--plain",
            "--no-pager",
        ],
    )?;
    Ok(p::linux_antivirus_outcome(&p::parse_systemctl_units(&output.stdout)))
}

pub fn disk_encryption() -> Result<CheckOutcome<String>, String> {
    let lsblk = run_ok("lsblk", &["-J", "-o", "NAME,TYPE,MOUNTPOINT"]);
    let proc_mounts = std::fs::read_to_string("/proc/mounts").ok();
    let home = std::env::var("HOME").ok();

    let lsblk_json = lsblk.as_ref().ok().map(|o| o.stdout.as_str());
    p::linux_encryption_outcome(lsblk_json, proc_mounts.as_deref(), home.as_deref()).map_err(|e| {
        match &lsblk {
            Err(lsblk_error) => format!("{e}: {lsblk_error}"),
            Ok(_) => e,
        }
    })
}

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.trim().is_empty())
}

fn gsettings(schema: &str, key: &str) -> Result<String, String> {
    run_ok("gsettings", &["get", schema, key]).map(|o| o.stdout.trim().to_string())
}

fn gsettings_bool(schema: &str, key: &str) -> Result<bool, String> {
    let value = gsettings(schema, key)?;
    p::parse_gsettings_bool(&value)
        .ok_or_else(|| format!("unexpected value \"{value}\" for {schema} {key}"))
}

fn gsettings_uint(schema: &str, key: &str) -> Result<u32, String> {
    let value = gsettings(schema, key)?;
    p::parse_gsettings_uint(&value)
        .ok_or_else(|| format!("unexpected value \"{value}\" for {schema} {key}"))
}

/// GNOME and Cinnamon share the same keys, in seconds.
fn gnome_like(prefix: &str) -> Result<CheckOutcome<u32>, String> {
    let screensaver = format!("{prefix}.desktop.screensaver");
    let session = format!("{prefix}.desktop.session");
    let lock_enabled = gsettings_bool(&screensaver, "lock-enabled")?;
    let idle = gsettings_uint(&session, "idle-delay")?;
    let lock_delay = gsettings_uint(&screensaver, "lock-delay").unwrap_or(0);
    Ok(p::gsettings_lock_outcome(lock_enabled, None, idle, lock_delay))
}

/// MATE stores its delays in minutes.
fn mate() -> Result<CheckOutcome<u32>, String> {
    let lock_enabled = gsettings_bool("org.mate.screensaver", "lock-enabled")?;
    let idle_activation = gsettings_bool("org.mate.screensaver", "idle-activation-enabled").ok();
    let idle_mins = gsettings_uint("org.mate.session", "idle-delay")?;
    let lock_delay_mins = gsettings_uint("org.mate.screensaver", "lock-delay").unwrap_or(0);
    Ok(p::gsettings_lock_outcome(
        lock_enabled,
        idle_activation,
        idle_mins.saturating_mul(60),
        lock_delay_mins.saturating_mul(60),
    ))
}

fn kde() -> Result<CheckOutcome<u32>, String> {
    let read = |tool: &str, key: &str| {
        run_ok(
            tool,
            &["--file", "kscreenlockerrc", "--group", "Daemon", "--key", key],
        )
        .map(|o| o.stdout.trim().to_string())
    };
    let tool = if read("kreadconfig6", "Autolock").is_ok() {
        "kreadconfig6"
    } else {
        "kreadconfig5"
    };
    let autolock = read(tool, "Autolock")?;
    let timeout = read(tool, "Timeout")?;
    let grace = read(tool, "LockGrace").unwrap_or_default();
    p::kde_lock_outcome(&autolock, &timeout, &grace)
}

pub fn screen_lock() -> Result<CheckOutcome<u32>, String> {
    let desktop = p::detect_linux_desktop(
        env("XDG_CURRENT_DESKTOP").as_deref(),
        env("XDG_SESSION_DESKTOP").as_deref(),
        env("DESKTOP_SESSION").as_deref(),
        Path::new("/usr/bin/gnome-session").exists(),
    )?;
    match desktop {
        LinuxDesktop::Gnome => gnome_like("org.gnome"),
        LinuxDesktop::Cinnamon => gnome_like("org.cinnamon"),
        LinuxDesktop::Mate => mate(),
        LinuxDesktop::Kde => kde(),
    }
}
