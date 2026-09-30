use tauri::Manager;
use tauri_plugin_window_state::StateFlags;
mod commands;
mod desktop;
mod device;
mod security;
mod supabase;
mod supabase_credentials;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        // Must be registered first so a second launch exits before any other
        // plugin (window state, notifications, ...) initializes
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            desktop::show_main_window(app);
        }))
        .setup(|app| {
            let local_data_dir = app.path().app_local_data_dir()?;
            device::set_fallback_dir(local_data_dir.clone());

            app.manage(desktop::DesktopState::load(Some(local_data_dir)));
            let handle = app.handle().clone();
            desktop::setup_tray(&handle);
            let state = app.state::<desktop::DesktopState>();
            desktop::apply_shortcut(&handle, state.settings().quick_capture_shortcut);

            // The main window is created hidden (tauri.conf.json) so a login
            // launch can stay in the tray without flashing the window.
            let launched_at_login = std::env::args().any(|arg| arg == desktop::AUTOSTART_ARG);
            if !desktop::start_hidden(&state, launched_at_login) {
                desktop::show_main_window(&handle);
            }
            Ok(())
        })
        .on_window_event(desktop::on_window_event)
        .plugin(
            // Visibility is managed by the app (tray / start hidden), not restored
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![desktop::AUTOSTART_ARG]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(desktop::on_global_shortcut)
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
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
            desktop::get_desktop_status,
            desktop::set_desktop_settings,
            desktop::set_autostart,
        ])
        .build(tauri::generate_context!());

    let app = match result {
        Ok(app) => app,
        Err(error) => {
            eprintln!("error while running tauri application: {error}");
            std::process::exit(1);
        }
    };

    app.run(|_app, _event| {
        // macOS: clicking the Dock icon while the window is hidden in the tray
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = _event
        {
            desktop::show_main_window(_app);
        }
    });
}
