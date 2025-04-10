use tauri::Manager;
mod commands;
mod device;
mod security;
mod supabase;
mod credentials;

pub use credentials::SupabaseCredentials;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_device_info,
            security::get_antivirus_info,
            security::get_disk_encryption_info,
            security::get_screen_lock_info,
            supabase::send_security_report,
            supabase::get_last_report,
            credentials::has_supabase_credentials,
            credentials::remove_supabase_credentials,
            credentials::save_supabase_credentials
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
