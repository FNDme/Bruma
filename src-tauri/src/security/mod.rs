//! Device security checks (antivirus, disk encryption, screen lock).
//!
//! Each check returns `Ok(CheckOutcome)` when it ran, with `compliant` saying
//! whether the device passes and `detail` saying why, or `Err(reason)` when
//! it could not run at all. Checks run on a blocking thread, every command
//! has its own timeout (see `runner`), and the whole check has an overall
//! limit, so the UI can never be stuck in "running".

mod parsers;
pub(crate) mod runner;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

pub use parsers::CheckOutcome;

use std::time::Duration;

#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(target_os = "windows")]
use windows as platform;

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod platform {
    use super::CheckOutcome;

    const UNSUPPORTED: &str = "this check is not supported on this operating system";

    pub fn antivirus() -> Result<CheckOutcome<String>, String> {
        Err(UNSUPPORTED.to_string())
    }
    pub fn disk_encryption() -> Result<CheckOutcome<String>, String> {
        Err(UNSUPPORTED.to_string())
    }
    pub fn screen_lock() -> Result<CheckOutcome<u32>, String> {
        Err(UNSUPPORTED.to_string())
    }
}

/// Upper bound for a whole check, which may run a few commands in a row.
const CHECK_TIMEOUT: Duration = Duration::from_secs(40);

async fn run_check<T, F>(name: &str, check: F) -> Result<CheckOutcome<T>, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<CheckOutcome<T>, String> + Send + 'static,
{
    let task = tauri::async_runtime::spawn_blocking(check);
    match tokio::time::timeout(CHECK_TIMEOUT, task).await {
        Ok(Ok(result)) => result,
        Ok(Err(error)) => Err(format!("the {name} check stopped unexpectedly: {error}")),
        Err(_) => Err(format!(
            "the {name} check did not finish within {} seconds",
            CHECK_TIMEOUT.as_secs()
        )),
    }
}

#[tauri::command]
pub async fn get_antivirus_info() -> Result<CheckOutcome<String>, String> {
    run_check("antivirus", platform::antivirus).await
}

#[tauri::command]
pub async fn get_disk_encryption_info() -> Result<CheckOutcome<String>, String> {
    run_check("disk encryption", platform::disk_encryption).await
}

#[tauri::command]
pub async fn get_screen_lock_info() -> Result<CheckOutcome<u32>, String> {
    run_check("screen lock", platform::screen_lock).await
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Runs the real probes on this machine: `cargo test -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn probes_run_on_this_machine() {
        println!("antivirus: {:?}", platform::antivirus());
        println!("disk encryption: {:?}", platform::disk_encryption());
        println!("screen lock: {:?}", platform::screen_lock());
    }
}
