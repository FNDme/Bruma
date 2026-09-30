//! Pure parsers and decision logic for the security checks.
//!
//! Nothing in here runs a command or touches the file system, so every
//! platform's parsers compile (and are unit tested) on every OS. The
//! platform probes in `security::{macos, windows, linux}` collect the raw
//! command output and hand it to these functions.

use serde::Serialize;

pub mod linux;
pub mod macos;
pub mod windows;

/// The result of a check that ran successfully.
///
/// `compliant == false` means the check ran and the device does not meet the
/// requirement (for example FileVault is off). A check that could not run at
/// all (missing tool, unreadable output, timeout) is an `Err` instead.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct CheckOutcome<T> {
    pub compliant: bool,
    /// The value recorded in the report; only set when compliant.
    pub value: Option<T>,
    /// A human readable explanation shown under the check.
    pub detail: String,
}

impl<T> CheckOutcome<T> {
    pub fn pass(value: T, detail: impl Into<String>) -> Self {
        Self {
            compliant: true,
            value: Some(value),
            detail: detail.into(),
        }
    }

    pub fn fail(detail: impl Into<String>) -> Self {
        Self {
            compliant: false,
            value: None,
            detail: detail.into(),
        }
    }
}

/// Whole minutes, rounded up, so a 90 second timeout reports as 2 minutes.
pub fn secs_to_minutes(secs: u32) -> u32 {
    secs.div_ceil(60)
}

pub fn plural_minutes(minutes: u32) -> String {
    if minutes == 1 {
        "1 minute".to_string()
    } else {
        format!("{minutes} minutes")
    }
}

/// Strips a UTF-8 byte order mark and surrounding whitespace.
pub(crate) fn clean_output(raw: &str) -> &str {
    raw.trim_start_matches('\u{feff}').trim()
}

/// Joins names, dropping duplicates while keeping their first-seen order.
pub(crate) fn join_unique<'a>(names: impl IntoIterator<Item = &'a str>) -> String {
    let mut seen: Vec<&str> = Vec::new();
    for name in names {
        if !seen.contains(&name) {
            seen.push(name);
        }
    }
    seen.join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_seconds_up_to_minutes() {
        assert_eq!(secs_to_minutes(0), 0);
        assert_eq!(secs_to_minutes(60), 1);
        assert_eq!(secs_to_minutes(61), 2);
        assert_eq!(secs_to_minutes(600), 10);
    }

    #[test]
    fn joins_unique_names_in_order() {
        assert_eq!(join_unique(["B", "A", "B"]), "B, A");
        assert_eq!(clean_output("\u{feff}  [1] \r\n"), "[1]");
    }
}
