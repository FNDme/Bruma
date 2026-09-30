use crate::device;
use crate::supabase_credentials::{self, SupabaseCredentials};
use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::{Client, RequestBuilder, Response};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::Duration;
use tauri_plugin_os::{platform, version};

const TABLE: &str = "security_reports";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

#[derive(Serialize, Deserialize, Default)]
pub struct SecurityReport {
    antivirus: Option<String>,
    disk_encryption: Option<String>,
    screen_lock: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SupabaseReport {
    device_id: String,
    user_email: String,
    user_full_name: String,
    disk_encrypted: bool,
    encryption_type: String,
    antivirus_detected: bool,
    antivirus_name: String,
    screen_lock_active: bool,
    screen_lock_time: String,
    operating_system: String,
    os_version: String,
    last_check: String,
}

/// The part of a stored report the UI needs. Only `last_check` is selected so
/// rows with nulls in other columns (or extra columns) never fail to parse.
#[derive(Serialize, Deserialize, Clone)]
pub struct LastReport {
    last_check: String,
}

#[derive(Deserialize)]
struct StoredLastCheck {
    last_check: Option<String>,
}

fn http_client() -> Result<&'static Client, String> {
    if let Some(client) = HTTP_CLIENT.get() {
        return Ok(client);
    }
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Could not create HTTP client: {e}"))?;
    Ok(HTTP_CLIENT.get_or_init(|| client))
}

fn table_url(credentials: &SupabaseCredentials) -> String {
    format!("{}/rest/v1/{TABLE}", credentials.url.trim_end_matches('/'))
}

fn authorized(request: RequestBuilder, credentials: &SupabaseCredentials) -> RequestBuilder {
    request
        .header("apikey", &credentials.anon_key)
        .header("Authorization", format!("Bearer {}", credentials.anon_key))
}

/// PostgREST filters for this user's row on this device. Passed through
/// `.query()` so values like `a+b@x.com` are URL-encoded.
fn row_filter(user_email: &str, device_id: &str) -> [(&'static str, String); 2] {
    [
        ("user_email", format!("eq.{user_email}")),
        ("device_id", format!("eq.{device_id}")),
    ]
}

fn describe_send_error(action: &str, e: reqwest::Error) -> String {
    if e.is_timeout() {
        format!("{action}: the request to Supabase timed out")
    } else if e.is_connect() {
        format!("{action}: could not connect to Supabase ({e})")
    } else {
        format!("{action}: {e}")
    }
}

/// Parses a successful JSON response, or turns an error status into a readable message.
async fn read_json<T: DeserializeOwned>(response: Response, action: &str) -> Result<T, String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("{action}: could not read the response ({e})"))?;

    if !status.is_success() {
        let detail = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(str::to_string))
            .unwrap_or_else(|| body.trim().to_string());
        let detail = if detail.is_empty() {
            status.canonical_reason().unwrap_or("no details").to_string()
        } else {
            detail
        };
        return Err(format!("{action} (HTTP {}): {detail}", status.as_u16()));
    }

    serde_json::from_str(&body).map_err(|e| format!("{action}: unexpected response ({e})"))
}

async fn require_credentials() -> Result<SupabaseCredentials, String> {
    supabase_credentials::get_supabase_credentials()
        .await?
        .ok_or_else(|| "Supabase credentials not configured".to_string())
}

/// Converts stored timestamps to RFC 3339 UTC. Older versions wrote
/// `chrono::Local::now().to_string()`, e.g. `2025-03-01 10:20:30.123 -03:00`.
fn normalize_timestamp(raw: &str) -> String {
    let raw = raw.trim();
    DateTime::parse_from_rfc3339(raw)
        .or_else(|_| DateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S%.f %:z"))
        .or_else(|_| DateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S%.f%#z"))
        .map(|dt| dt.with_timezone(&Utc).to_rfc3339_opts(SecondsFormat::Millis, true))
        .unwrap_or_else(|_| raw.to_string())
}

#[tauri::command]
pub async fn send_security_report(
    user_email: String,
    user_full_name: String,
    report: SecurityReport,
) -> Result<bool, String> {
    let user_email = user_email.trim().to_string();
    let user_full_name = user_full_name.trim().to_string();
    if user_email.is_empty() || user_full_name.is_empty() {
        return Err("Your name and email are required to send a report".to_string());
    }

    let device_id = device::device_id().await?;
    let credentials = require_credentials().await?;
    let client = http_client()?;
    let url = table_url(&credentials);
    let filter = row_filter(&user_email, &device_id);

    let supabase_report = SupabaseReport {
        device_id: device_id.clone(),
        user_email: user_email.clone(),
        user_full_name,
        disk_encrypted: report.disk_encryption.is_some(),
        encryption_type: report.disk_encryption.unwrap_or_default(),
        antivirus_detected: report.antivirus.is_some(),
        antivirus_name: report.antivirus.unwrap_or_default(),
        screen_lock_active: report.screen_lock.is_some(),
        screen_lock_time: report.screen_lock.unwrap_or_default().to_string(),
        operating_system: platform().to_string(),
        os_version: version().to_string(),
        last_check: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
    };

    // 1. Does this user already have a row for this device?
    let lookup = "Failed to look up the existing report";
    let existing: Vec<serde_json::Value> = read_json(
        authorized(client.get(&url), &credentials)
            .query(&filter)
            .query(&[("select", "device_id"), ("limit", "1")])
            .send()
            .await
            .map_err(|e| describe_send_error(lookup, e))?,
        lookup,
    )
    .await?;

    // 2. Update that row only (both columns in the filter), or insert a new one.
    let (action, request) = if existing.is_empty() {
        ("Failed to send report", client.post(&url))
    } else {
        ("Failed to update report", client.patch(&url).query(&filter))
    };

    let rows: Vec<serde_json::Value> = read_json(
        authorized(request, &credentials)
            .header("Prefer", "return=representation")
            .json(&supabase_report)
            .send()
            .await
            .map_err(|e| describe_send_error(action, e))?,
        action,
    )
    .await?;

    if rows.is_empty() {
        return Err(format!(
            "{action}: Supabase did not store the report (no row was returned). \
             The table's permissions may not allow this change."
        ));
    }
    Ok(true)
}

#[tauri::command]
pub async fn get_last_report(user_email: String) -> Result<Option<LastReport>, String> {
    let user_email = user_email.trim().to_string();
    if user_email.is_empty() {
        return Ok(None);
    }
    let Some(credentials) = supabase_credentials::get_supabase_credentials().await? else {
        return Ok(None);
    };
    let device_id = device::device_id().await?;
    let client = http_client()?;

    let action = "Failed to get the last report";
    let reports: Vec<StoredLastCheck> = read_json(
        authorized(client.get(table_url(&credentials)), &credentials)
            .query(&row_filter(&user_email, &device_id))
            .query(&[
                ("select", "last_check"),
                ("order", "last_check.desc.nullslast"),
                ("limit", "1"),
            ])
            .send()
            .await
            .map_err(|e| describe_send_error(action, e))?,
        action,
    )
    .await?;

    Ok(reports
        .into_iter()
        .next()
        .and_then(|r| r.last_check)
        .map(|raw| LastReport {
            last_check: normalize_timestamp(&raw),
        }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_old_and_new_timestamps() {
        assert_eq!(
            normalize_timestamp("2025-03-01 10:20:30.123456789 -03:00"),
            "2025-03-01T13:20:30.123Z"
        );
        assert_eq!(
            normalize_timestamp("2025-03-01T13:20:30.5+00:00"),
            "2025-03-01T13:20:30.500Z"
        );
        assert_eq!(normalize_timestamp("garbage"), "garbage");
    }

    #[test]
    fn row_filter_uses_both_columns() {
        let filter = row_filter("a+b@x.com", "dev&1");
        assert_eq!(filter[0], ("user_email", "eq.a+b@x.com".to_string()));
        assert_eq!(filter[1], ("device_id", "eq.dev&1".to_string()));

        let url = Client::new()
            .get("https://example.supabase.co/rest/v1/security_reports")
            .query(&filter)
            .build()
            .unwrap()
            .url()
            .to_string();
        assert!(url.contains("user_email=eq.a%2Bb%40x.com"), "{url}");
        assert!(url.contains("device_id=eq.dev%261"), "{url}");
    }
}
