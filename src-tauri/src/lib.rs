//! Mudbrick v2 -- Tauri Commands
//!
//! Custom Tauri commands exposed to the frontend via `invoke()`.

use tauri::command;

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

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            get_app_data_dir,
            check_backend_health,
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
