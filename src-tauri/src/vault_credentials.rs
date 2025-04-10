use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::str;

const SERVICE: &str = "bruma";
const USERNAME: &str = "vault_credentials";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultCredentials {
    pub salt: String,
    pub hashed_password: String,
}

#[tauri::command]
pub async fn save_vault_credentials(credentials: VaultCredentials) -> Result<(), String> {
    let serialized = serde_json::to_string(&credentials).map_err(|e| e.to_string())?;
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    entry.set_secret(serialized.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_vault_credentials() -> Result<Option<VaultCredentials>, String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    
    match entry.get_secret() {
        Ok(credential) => {
            let credential_str = str::from_utf8(&credential).map_err(|e| e.to_string())?;
            let creds = serde_json::from_str(credential_str).map_err(|e| e.to_string())?;
            Ok(Some(creds))
        }
        Err(e) => {
            println!("No vault credentials found: {:?}", e);
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn has_vault_credentials() -> Result<bool, String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    match entry.get_secret() {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn reset_vault_credentials() -> Result<(), String> {
    let entry = Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(())
}

