use tauri::Manager;
mod commands;
mod device;
mod security;
mod supabase;
mod supabase_credentials;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("salt.txt");
            app.handle().plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            Ok(())
        })
        .plugin(tauri_plugin_window_state::Builder::new().build())
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
            supabase_credentials::has_supabase_credentials,
            supabase_credentials::remove_supabase_credentials,
            supabase_credentials::save_supabase_credentials,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
