use serde::{Deserialize, Serialize};
use keyring::Entry;
use std::str;

const SERVICE: &str = "bruma";
const USERNAME: &str = "supabase_credentials";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SupabaseCredentials {
    pub url: String,
    pub anon_key: String,
}

pub async fn get_supabase_credentials() -> Result<Option<SupabaseCredentials>, String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;

    match entry.get_secret() {
        Ok(credential) => {
            let credential_str = str::from_utf8(&credential).map_err(|e| e.to_string())?;
            let creds = serde_json::from_str(credential_str).map_err(|e| e.to_string())?;
            Ok(Some(creds))
        }
        Err(e) => {
            println!("No credentials found in keyring: {:?}", e);
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn save_supabase_credentials(
    request: SupabaseCredentials,
) -> Result<(), String> {
    let serialized = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    if let Err(e) = entry.set_secret(serialized.as_bytes()) {
        println!("Error saving to keyring: {:?}", e);
        return Err(e.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_supabase_credentials() -> Result<(), String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn has_supabase_credentials() -> Result<bool, String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;

    match entry.get_secret() {
        Ok(_) => Ok(true),
        Err(e) => {
            println!("No credentials found in keyring: {:?}", e);
            Ok(false)
        }
    }
}