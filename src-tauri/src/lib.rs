// JARVIS desktop shell (Phase 5B).
//
// Two windows, both running the same web app:
// - "main": the full JARVIS app. Closing it hides to the tray; Quit is in the
//   tray menu, so the app keeps running for reminders.
// - "quickpanel": frameless, transparent, always-on-top Quick Panel, hidden
//   until Ctrl+Space (global) or the tray menu toggles it. The web app renders
//   only the panel when its window label is "quickpanel".

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow, WindowEvent,
};

const MAIN: &str = "main";
const QUICK_PANEL: &str = "quickpanel";

/// Gap between the top of the screen and the panel, in logical pixels.
const PANEL_TOP_MARGIN: f64 = 48.0;

fn place_top_center(window: &WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) else {
        return;
    };
    let area = monitor.size();
    let origin = monitor.position();
    let x = origin.x + (area.width as i32 - size.width as i32) / 2;
    let y = origin.y + (PANEL_TOP_MARGIN * monitor.scale_factor()) as i32;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn toggle_panel(app: &AppHandle) {
    let Some(panel) = app.get_webview_window(QUICK_PANEL) else {
        return;
    };
    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
    } else {
        place_top_center(&panel);
        let _ = panel.show();
        let _ = panel.set_focus();
        // Lets the panel refetch assignments and reset to its first tab.
        let _ = panel.emit_to(QUICK_PANEL, "quickpanel:shown", ());
    }
}

fn show_main_window(app: &AppHandle, view: Option<String>) {
    if let Some(main) = app.get_webview_window(MAIN) {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
        if let Some(view) = view {
            let _ = main.emit_to(MAIN, "jarvis:navigate", view);
        }
    }
}

#[tauri::command]
fn toggle_quick_panel(app: AppHandle) {
    toggle_panel(&app);
}

/// Show the main window, optionally switching it to `view` (e.g. "assignments").
#[tauri::command]
fn show_main(app: AppHandle, view: Option<String>) {
    show_main_window(&app, view);
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open JARVIS", true, None::<&str>)?;
    let panel = MenuItem::with_id(app, "panel", "Quick Panel\tCtrl+Space", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit JARVIS", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &panel, &quit])?;

    let mut tray = TrayIconBuilder::with_id("jarvis")
        .tooltip("JARVIS")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app, None),
            "panel" => toggle_panel(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle(), None);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg(desktop)]
fn register_panel_shortcut(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let hotkey = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, pressed, event| {
                if pressed == &hotkey && event.state() == ShortcutState::Pressed {
                    toggle_panel(app);
                }
            })
            .build(),
    )?;
    // Another program may already own Ctrl+Space; the tray menu and the
    // in-app header button still work, so don't fail startup over it.
    if let Err(err) = app.global_shortcut().register(hotkey) {
        log::warn!("Ctrl+Space unavailable as a global shortcut: {err}");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            build_tray(app)?;
            #[cfg(desktop)]
            register_panel_shortcut(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == MAIN {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![toggle_quick_panel, show_main])
        .run(tauri::generate_context!())
        .expect("error while running JARVIS");
}
