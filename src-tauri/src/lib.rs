//! Mudbrick v2 -- Tauri Commands
//!
//! Custom Tauri commands exposed to the frontend via `invoke()`.

use std::sync::Mutex;

use serde::Serialize;
use tauri::command;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

struct PendingUpdate(Mutex<Option<Update>>);

impl Default for PendingUpdate {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(Clone)]
struct UpdaterConfig {
    endpoint: String,
    pubkey: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    configured: bool,
    endpoint: Option<String>,
    current_version: String,
    update_available: bool,
    latest_version: Option<String>,
}

/// Get the app data directory path.
#[command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

/// Check if the Python sidecar backend is responding.
#[command]
pub async fn check_backend_health() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client
        .get("http://localhost:8000/api/health")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Check whether signed app updates are configured and available.
#[command]
pub async fn check_for_app_update(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
) -> Result<UpdateStatus, String> {
    let current_version = app.package_info().version.to_string();

    let Some(config) = updater_config() else {
        clear_pending_update(&pending_update)?;
        return Ok(UpdateStatus {
            configured: false,
            endpoint: None,
            current_version,
            update_available: false,
            latest_version: None,
        });
    };

    let endpoint = Url::parse(&config.endpoint)
        .map_err(|e| format!("Invalid updater endpoint '{}': {}", config.endpoint, e))?;

    let update = app
        .updater_builder()
        .pubkey(config.pubkey)
        .endpoints(vec![endpoint])
        .map_err(|e| format!("Failed to configure updater endpoints: {}", e))?
        .build()
        .map_err(|e| format!("Failed to build updater: {}", e))?
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    let latest_version = update.as_ref().map(|value| value.version.clone());
    let update_available = latest_version.is_some();

    *pending_update
        .0
        .lock()
        .map_err(|_| String::from("Updater state lock poisoned"))? = update;

    Ok(UpdateStatus {
        configured: true,
        endpoint: Some(config.endpoint),
        current_version,
        update_available,
        latest_version,
    })
}

/// Install a pending app update, if one was fetched previously.
#[command]
pub async fn install_app_update(
    pending_update: State<'_, PendingUpdate>,
) -> Result<bool, String> {
    let update = pending_update
        .0
        .lock()
        .map_err(|_| String::from("Updater state lock poisoned"))?
        .take();

    let Some(update) = update else {
        return Ok(false);
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| format!("Failed to install update: {}", e))?;

    Ok(true)
}

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            get_app_data_dir,
            check_backend_health,
            check_for_app_update,
            install_app_update,
        ])
        .setup(|app| {
            // Spawn the Python sidecar on app start
            spawn_sidecar(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running Mudbrick");
}

/// Spawn the Python API sidecar process.
fn spawn_sidecar(app: tauri::AppHandle) {
    use tauri_plugin_shell::ShellExt;

    let shell = app.shell();

    // Try to spawn the sidecar binary (PyInstaller-built backend)
    match shell.sidecar("mudbrick-api") {
        Ok(sidecar) => {
            match sidecar.spawn() {
                Ok((_rx, _child)) => {
                    println!("Mudbrick API sidecar spawned successfully");
                    // Wait for the backend to be ready
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        wait_for_backend(&app_clone).await;
                    });
                }
                Err(e) => {
                    eprintln!("Failed to spawn sidecar: {}. Backend may need to be started manually.", e);
                }
            }
        }
        Err(e) => {
            eprintln!(
                "Sidecar binary not found: {}. Run backend manually with: uvicorn app.main:app --port 8000",
                e
            );
        }
    }
}

/// Wait for the backend health check to succeed (up to 30 seconds).
async fn wait_for_backend(_app: &tauri::AppHandle) {
    let client = reqwest::Client::new();
    let max_attempts = 30;

    for attempt in 1..=max_attempts {
        match client
            .get("http://localhost:8000/api/health")
            .timeout(std::time::Duration::from_secs(1))
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                println!("Backend ready after {} attempt(s)", attempt);
                return;
            }
            _ => {
                if attempt < max_attempts {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    }
    eprintln!("Warning: Backend did not respond within 30 seconds");
}

fn updater_config() -> Option<UpdaterConfig> {
    let endpoint = std::env::var("MUDBRICK_UPDATER_ENDPOINT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            option_env!("MUDBRICK_UPDATER_ENDPOINT")
                .map(str::to_string)
                .filter(|value| !value.trim().is_empty())
        })?;

    let pubkey = std::env::var("MUDBRICK_UPDATER_PUBKEY")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            option_env!("MUDBRICK_UPDATER_PUBKEY")
                .map(str::to_string)
                .filter(|value| !value.trim().is_empty())
        })?;

    Some(UpdaterConfig { endpoint, pubkey })
}

fn clear_pending_update(pending_update: &State<'_, PendingUpdate>) -> Result<(), String> {
    *pending_update
        .0
        .lock()
        .map_err(|_| String::from("Updater state lock poisoned"))? = None;
    Ok(())
}
