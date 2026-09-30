use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::str;

const SERVICE: &str = "bruma";
const USERNAME: &str = "supabase_credentials";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SupabaseCredentials {
    pub url: String,
    pub anon_key: String,
}

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USERNAME).map_err(|e| format!("Could not open the system keychain: {e}"))
}

/// Normalizes and validates a Supabase project URL: trims whitespace and trailing
/// slashes and requires https (plain http is only accepted for localhost).
pub fn normalize_url(raw: &str) -> Result<String, String> {
    let url = raw.trim().trim_end_matches('/').to_string();
    let parsed = reqwest::Url::parse(&url).map_err(|_| format!("Invalid Supabase URL: {url}"))?;
    let is_local = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    match parsed.scheme() {
        "https" => {}
        "http" if is_local => {}
        _ => return Err("Supabase URL must start with https://".to_string()),
    }
    if parsed.host_str().is_none() {
        return Err(format!("Invalid Supabase URL: {url}"));
    }
    Ok(url)
}

pub async fn get_supabase_credentials() -> Result<Option<SupabaseCredentials>, String> {
    match entry()?.get_secret() {
        Ok(credential) => {
            let credential_str = str::from_utf8(&credential)
                .map_err(|e| format!("Stored Supabase credentials are unreadable: {e}"))?;
            let mut creds: SupabaseCredentials = serde_json::from_str(credential_str)
                .map_err(|e| format!("Stored Supabase credentials are unreadable: {e}"))?;
            // Older versions saved the URL as typed (e.g. with a trailing slash)
            creds.url = creds.url.trim().trim_end_matches('/').to_string();
            Ok(Some(creds))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not read Supabase credentials from the keychain: {e}")),
    }
}

#[tauri::command]
pub async fn save_supabase_credentials(request: SupabaseCredentials) -> Result<(), String> {
    let anon_key = request.anon_key.trim().to_string();
    if anon_key.is_empty() {
        return Err("The anonymous key is required".to_string());
    }
    let creds = SupabaseCredentials {
        url: normalize_url(&request.url)?,
        anon_key,
    };
    let serialized = serde_json::to_string(&creds).map_err(|e| e.to_string())?;
    entry()?
        .set_secret(serialized.as_bytes())
        .map_err(|e| format!("Could not save Supabase credentials to the keychain: {e}"))
}

#[tauri::command]
pub async fn remove_supabase_credentials() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Could not remove Supabase credentials from the keychain: {e}")),
    }
}

#[tauri::command]
pub async fn has_supabase_credentials() -> Result<bool, String> {
    match entry()?.get_secret() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Could not read Supabase credentials from the keychain: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_url;

    #[test]
    fn normalizes_supabase_urls() {
        assert_eq!(
            normalize_url(" https://abc.supabase.co/ ").as_deref(),
            Ok("https://abc.supabase.co")
        );
        assert_eq!(
            normalize_url("http://localhost:54321//").as_deref(),
            Ok("http://localhost:54321")
        );
        assert!(normalize_url("http://abc.supabase.co").is_err());
        assert!(normalize_url("abc.supabase.co").is_err());
        assert!(normalize_url("").is_err());
    }
}
