//! macOS probes: collect command output and hand it to `parsers::macos`.

use super::parsers::macos::{self as p, MAC_AV_PRODUCTS};
use super::parsers::CheckOutcome;
use super::runner::{run, run_ok};
use std::path::Path;

const XPROTECT_BUNDLES: &[&str] = &[
    "/Library/Apple/System/Library/CoreServices/XProtect.bundle",
    "/Library/Apple/System/Library/CoreServices/XProtect.app",
];

pub fn antivirus() -> Result<CheckOutcome<String>, String> {
    // If ps fails, products are still detected by their install location
    let processes = run_ok("ps", &["-axo", "comm="])
        .map(|o| p::parse_process_names(&o.stdout))
        .unwrap_or_default();

    let mut running = Vec::new();
    let mut installed = Vec::new();
    for product in MAC_AV_PRODUCTS {
        if product.processes.iter().any(|name| processes.contains(*name)) {
            running.push(product.name);
        } else if product.paths.iter().any(|path| Path::new(path).exists()) {
            installed.push(product.name);
        }
    }

    let xprotect = XPROTECT_BUNDLES.iter().find(|path| Path::new(path).exists());
    let xprotect_version = xprotect.and_then(|bundle| {
        let info = format!("{bundle}/Contents/Info");
        run_ok("defaults", &["read", &info, "CFBundleShortVersionString"])
            .ok()
            .map(|o| o.stdout.trim().to_string())
            .filter(|v| !v.is_empty())
    });

    // Only needed when XProtect is the sole protection
    let gatekeeper = if running.is_empty() && installed.is_empty() {
        run("spctl", &["--status"])
            .ok()
            .and_then(|o| p::parse_gatekeeper_status(&o.combined()))
    } else {
        None
    };

    Ok(p::macos_antivirus_outcome(
        &running,
        &installed,
        xprotect.is_some(),
        xprotect_version.as_deref(),
        gatekeeper,
    ))
}

pub fn disk_encryption() -> Result<CheckOutcome<String>, String> {
    let diskutil = run_ok("diskutil", &["info", "/"]);
    if let Some(status) = diskutil
        .as_ref()
        .ok()
        .and_then(|o| p::filevault_from_diskutil(&o.stdout))
    {
        return Ok(p::filevault_outcome(status));
    }

    let fdesetup = run("fdesetup", &["status"]).map_err(|e| match &diskutil {
        Err(diskutil_error) => format!("{diskutil_error}; {e}"),
        Ok(_) => e,
    })?;
    p::filevault_from_fdesetup(&fdesetup.combined())
        .map(p::filevault_outcome)
        .ok_or_else(|| "could not read the FileVault status from diskutil or fdesetup".to_string())
}

pub fn screen_lock() -> Result<CheckOutcome<u32>, String> {
    // sysadminctl writes its answer to stderr, not stdout
    let status = run("sysadminctl", &["-screenLock", "status"])?;

    // Missing when the screen saver was never configured; treated as "never"
    let screensaver_secs = run("defaults", &["-currentHost", "read", "com.apple.screensaver", "idleTime"])
        .ok()
        .filter(|o| o.success)
        .and_then(|o| o.stdout.trim().parse::<u32>().ok());

    let pmset = run_ok("pmset", &["-g", "custom"])?;
    p::macos_screen_lock_outcome(&status.combined(), screensaver_secs, &pmset.stdout)
}
