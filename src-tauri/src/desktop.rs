//! Desktop integration: tray icon, quick-capture global shortcut, launch at
//! login and "keep running in the tray" when the main window is closed.
//!
//! These settings live on the Rust side (in `<app_local_data_dir>/desktop-settings.json`)
//! because they are needed before the webview has loaded: whether to show the
//! window at startup, what to do on close, and which global shortcut to grab.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Window, WindowEvent};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutEvent, ShortcutState};

pub const MAIN_WINDOW: &str = "main";
/// Passed by the login item so the app knows it was started automatically.
pub const AUTOSTART_ARG: &str = "--autostart";
/// Global quick-capture shortcut (⌘⇧Space on macOS, Ctrl+Shift+Space elsewhere).
pub const QUICK_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+Space";
/// Event sent to the main window when a tray item or the global shortcut is used.
pub const ACTION_EVENT: &str = "bruma://desktop-action";

const SETTINGS_FILE: &str = "desktop-settings.json";
const TRAY_ID: &str = "bruma-tray";

/// Actions the webview handles (see src/lib/desktop.ts).
mod action {
    pub const QUICK_CAPTURE: &str = "quick-capture";
    pub const QUICK_NOTE: &str = "quick-note";
    pub const QUICK_TODO: &str = "quick-todo";
    pub const RUN_CHECKS: &str = "run-checks";
}

mod menu_id {
    pub const OPEN: &str = "open";
    pub const QUICK_NOTE: &str = "quick-note";
    pub const QUICK_TODO: &str = "quick-todo";
    pub const RUN_CHECKS: &str = "run-checks";
    pub const QUIT: &str = "quit";
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DesktopSettings {
    /// Closing the main window hides it to the tray instead of quitting.
    pub close_to_tray: bool,
    /// Register the global quick-capture shortcut.
    pub quick_capture_shortcut: bool,
    /// When launched at login, stay in the tray instead of opening the window.
    pub start_hidden_at_login: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            close_to_tray: false,
            quick_capture_shortcut: true,
            start_hidden_at_login: false,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettingsPatch {
    close_to_tray: Option<bool>,
    quick_capture_shortcut: Option<bool>,
    start_hidden_at_login: Option<bool>,
}

impl DesktopSettings {
    fn apply(mut self, patch: &DesktopSettingsPatch) -> Self {
        if let Some(value) = patch.close_to_tray {
            self.close_to_tray = value;
        }
        if let Some(value) = patch.quick_capture_shortcut {
            self.quick_capture_shortcut = value;
        }
        if let Some(value) = patch.start_hidden_at_login {
            self.start_hidden_at_login = value;
        }
        self
    }
}

/// Parses the settings file, falling back to defaults for a missing or unreadable file.
fn parse_settings(raw: &str) -> DesktopSettings {
    serde_json::from_str(raw).unwrap_or_else(|e| {
        eprintln!("Ignoring unreadable {SETTINGS_FILE}: {e}");
        DesktopSettings::default()
    })
}

pub struct DesktopState {
    settings: Mutex<DesktopSettings>,
    path: Option<PathBuf>,
    tray_available: AtomicBool,
    shortcut_error: Mutex<Option<String>>,
}

impl DesktopState {
    pub fn load(dir: Option<PathBuf>) -> Self {
        let path = dir.map(|d| d.join(SETTINGS_FILE));
        let settings = path
            .as_ref()
            .and_then(|p| fs::read_to_string(p).ok())
            .map(|raw| parse_settings(&raw))
            .unwrap_or_default();
        Self {
            settings: Mutex::new(settings),
            path,
            tray_available: AtomicBool::new(false),
            shortcut_error: Mutex::new(None),
        }
    }

    pub fn settings(&self) -> DesktopSettings {
        *self.settings.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn tray_available(&self) -> bool {
        self.tray_available.load(Ordering::SeqCst)
    }

    /// Hiding without a tray icon would leave no way back to the window.
    fn should_hide_on_close(&self) -> bool {
        self.settings().close_to_tray && self.tray_available()
    }

    fn save(&self, settings: DesktopSettings) -> Result<(), String> {
        let path = self
            .path
            .as_ref()
            .ok_or_else(|| "No data folder is available to save the setting".to_string())?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Could not create {parent:?}: {e}"))?;
        }
        let json = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Could not serialize the settings: {e}"))?;
        // Write-then-rename so a crash never leaves a half-written file behind
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| format!("Could not save the settings: {e}"))?;
        fs::rename(&tmp, path).map_err(|e| format!("Could not save the settings: {e}"))?;
        *self.settings.lock().unwrap_or_else(|e| e.into_inner()) = settings;
        Ok(())
    }

    fn set_shortcut_error(&self, error: Option<String>) {
        *self.shortcut_error.lock().unwrap_or_else(|e| e.into_inner()) = error;
    }

    fn shortcut_error(&self) -> Option<String> {
        self.shortcut_error
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
}

/// Brings the main window back from hidden, minimized or behind other windows.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionPayload {
    action: &'static str,
    /// The window was hidden in the tray, so quick capture can hide it again when done
    was_hidden: bool,
}

fn send_action<R: Runtime>(app: &AppHandle<R>, action: &'static str) {
    let was_hidden = app
        .get_webview_window(MAIN_WINDOW)
        .and_then(|window| window.is_visible().ok())
        .is_some_and(|visible| !visible);
    show_main_window(app);
    let payload = ActionPayload { action, was_hidden };
    if let Err(e) = app.emit_to(MAIN_WINDOW, ACTION_EVENT, payload) {
        eprintln!("Could not send {action} to the main window: {e}");
    }
}

/// Creates the tray icon. Returns false when the platform has no tray
/// (e.g. a Linux desktop without an AppIndicator host), in which case the
/// app keeps working without it and "close to tray" stays inactive.
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> bool {
    #[cfg(target_os = "linux")]
    if !appindicator_available() {
        eprintln!(
            "Could not create the tray icon: libayatana-appindicator3 (or libappindicator3) is not installed"
        );
        return false;
    }

    // The Linux backend panics (instead of returning an error) when it cannot
    // load its tray library; never let that take the whole app down.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| build_tray(app)))
        .unwrap_or_else(|_| {
            Err(tauri::Error::from(std::io::Error::other(
                "the tray backend panicked",
            )))
        });
    match result {
        Ok(()) => {
            app.state::<DesktopState>()
                .tray_available
                .store(true, Ordering::SeqCst);
            true
        }
        Err(e) => {
            eprintln!("Could not create the tray icon: {e}");
            false
        }
    }
}

/// The tray on Linux needs an AppIndicator library, which tray-icon loads at
/// runtime and panics without. Probe for it the same way first.
#[cfg(target_os = "linux")]
fn appindicator_available() -> bool {
    const LIBRARIES: [&std::ffi::CStr; 4] = [
        c"libayatana-appindicator3.so.1",
        c"libappindicator3.so.1",
        c"libayatana-appindicator3.so",
        c"libappindicator3.so",
    ];
    LIBRARIES.iter().any(|name| {
        // SAFETY: `name` is a valid NUL-terminated string, and the handle is
        // only used to close the library again.
        let handle = unsafe { libc::dlopen(name.as_ptr(), libc::RTLD_LAZY) };
        if handle.is_null() {
            return false;
        }
        // SAFETY: `handle` was returned by a successful dlopen above.
        unsafe { libc::dlclose(handle) };
        true
    })
}

fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, menu_id::OPEN, "Open Bruma", true, None::<&str>)?;
    let quick_note = MenuItem::with_id(app, menu_id::QUICK_NOTE, "Quick note…", true, None::<&str>)?;
    let quick_todo = MenuItem::with_id(app, menu_id::QUICK_TODO, "Quick todo…", true, None::<&str>)?;
    let run_checks = MenuItem::with_id(
        app,
        menu_id::RUN_CHECKS,
        "Run system checks",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, menu_id::QUIT, "Quit Bruma", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &PredefinedMenuItem::separator(app)?,
            &quick_note,
            &quick_todo,
            &run_checks,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("Bruma")
        .on_menu_event(|app, event| match event.id().as_ref() {
            menu_id::OPEN => show_main_window(app),
            menu_id::QUICK_NOTE => send_action(app, action::QUICK_NOTE),
            menu_id::QUICK_TODO => send_action(app, action::QUICK_TODO),
            menu_id::RUN_CHECKS => send_action(app, action::RUN_CHECKS),
            menu_id::QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Windows: left click opens the window, right click shows the menu.
            // (macOS shows the menu on any click; Linux does not report clicks.)
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.show_menu_on_left_click(false);
    }

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

/// Handler for the global-shortcut plugin.
pub fn on_global_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    _shortcut: &tauri_plugin_global_shortcut::Shortcut,
    event: ShortcutEvent,
) {
    if event.state == ShortcutState::Pressed {
        send_action(app, action::QUICK_CAPTURE);
    }
}

/// Registers or unregisters the quick-capture shortcut to match `enabled`.
/// A failure (usually another app owns the combo) is remembered for the UI.
pub fn apply_shortcut<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    let shortcuts = app.global_shortcut();
    let registered = shortcuts.is_registered(QUICK_CAPTURE_SHORTCUT);
    let result = match (enabled, registered) {
        (true, false) => shortcuts.register(QUICK_CAPTURE_SHORTCUT),
        (false, true) => shortcuts.unregister(QUICK_CAPTURE_SHORTCUT),
        _ => Ok(()),
    };
    let error = result.err().map(|e| {
        format!("Could not register {QUICK_CAPTURE_SHORTCUT}. Another app may already use it ({e}).")
    });
    if let Some(error) = &error {
        eprintln!("{error}");
    }
    app.state::<DesktopState>().set_shortcut_error(error);
}

/// Hides the main window instead of closing it when "close to tray" is on.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() != MAIN_WINDOW {
            return;
        }
        let Some(state) = window.try_state::<DesktopState>() else {
            return;
        };
        if state.should_hide_on_close() {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

/// Whether the main window should stay hidden at startup.
pub fn start_hidden(state: &DesktopState, launched_at_login: bool) -> bool {
    launched_at_login && state.settings().start_hidden_at_login && state.tray_available()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStatus {
    settings: DesktopSettings,
    tray_available: bool,
    quick_capture_combo: &'static str,
    shortcut_registered: bool,
    shortcut_error: Option<String>,
    /// None when the login item state could not be read
    autostart_enabled: Option<bool>,
    autostart_error: Option<String>,
}

fn status<R: Runtime>(app: &AppHandle<R>, state: &DesktopState) -> DesktopStatus {
    let (autostart_enabled, autostart_error) = match app.autolaunch().is_enabled() {
        Ok(enabled) => (Some(enabled), None),
        Err(e) => (None, Some(format!("Could not read the launch-at-login setting: {e}"))),
    };
    DesktopStatus {
        settings: state.settings(),
        tray_available: state.tray_available(),
        quick_capture_combo: QUICK_CAPTURE_SHORTCUT,
        shortcut_registered: app.global_shortcut().is_registered(QUICK_CAPTURE_SHORTCUT),
        shortcut_error: state.shortcut_error(),
        autostart_enabled,
        autostart_error,
    }
}

#[tauri::command]
pub fn get_desktop_status<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopState>,
) -> DesktopStatus {
    status(&app, &state)
}

#[tauri::command]
pub fn set_desktop_settings<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopState>,
    patch: DesktopSettingsPatch,
) -> Result<DesktopStatus, String> {
    let previous = state.settings();
    let next = previous.apply(&patch);
    state.save(next)?;
    if next.quick_capture_shortcut != previous.quick_capture_shortcut {
        apply_shortcut(&app, next.quick_capture_shortcut);
    }
    Ok(status(&app, &state))
}

#[tauri::command]
pub fn set_autostart<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopState>,
    enabled: bool,
) -> Result<DesktopStatus, String> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|e| {
        format!(
            "Could not {} launch at login: {e}",
            if enabled { "turn on" } else { "turn off" }
        )
    })?;
    Ok(status(&app, &state))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_keep_the_app_behaving_as_before() {
        let settings = DesktopSettings::default();
        assert!(!settings.close_to_tray);
        assert!(!settings.start_hidden_at_login);
        assert!(settings.quick_capture_shortcut);
    }

    #[test]
    fn parses_partial_and_invalid_files() {
        assert_eq!(parse_settings("{}"), DesktopSettings::default());
        assert!(parse_settings(r#"{"closeToTray":true}"#).close_to_tray);
        assert_eq!(parse_settings("not json"), DesktopSettings::default());
        // Unknown keys from a newer version are ignored
        assert!(parse_settings(r#"{"closeToTray":true,"future":1}"#).close_to_tray);
    }

    #[test]
    fn patch_only_changes_given_fields() {
        let patch = DesktopSettingsPatch {
            close_to_tray: Some(true),
            ..Default::default()
        };
        let next = DesktopSettings::default().apply(&patch);
        assert!(next.close_to_tray);
        assert!(next.quick_capture_shortcut);
        assert!(!next.start_hidden_at_login);
    }

    #[test]
    fn saves_and_reloads_settings() {
        let dir = std::env::temp_dir().join(format!("bruma-desktop-test-{}", uuid::Uuid::new_v4()));
        let state = DesktopState::load(Some(dir.clone()));
        assert_eq!(state.settings(), DesktopSettings::default());
        let next = DesktopSettings {
            close_to_tray: true,
            quick_capture_shortcut: false,
            start_hidden_at_login: true,
        };
        state.save(next).unwrap();
        assert_eq!(DesktopState::load(Some(dir.clone())).settings(), next);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn never_hides_without_a_tray() {
        let state = DesktopState::load(None);
        *state.settings.lock().unwrap() = DesktopSettings {
            close_to_tray: true,
            quick_capture_shortcut: true,
            start_hidden_at_login: true,
        };
        assert!(!state.should_hide_on_close());
        assert!(!start_hidden(&state, true));
        state.tray_available.store(true, Ordering::SeqCst);
        assert!(state.should_hide_on_close());
        assert!(start_hidden(&state, true));
        assert!(!start_hidden(&state, false));
    }

    #[test]
    fn shortcut_parses() {
        assert!(QUICK_CAPTURE_SHORTCUT
            .parse::<tauri_plugin_global_shortcut::Shortcut>()
            .is_ok());
    }
}
