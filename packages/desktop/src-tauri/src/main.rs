#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanRequest {
    selected_drives: Option<Vec<String>>,
    include_hidden: Option<bool>,
    max_depth: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanSummary {
    total_files: u64,
    total_size: u64,
    hidden_files: u64,
    issue_count: u64,
    deletable_files: u64,
    deletable_size: u64,
    review_files: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanResult {
    id: String,
    path: String,
    size: u64,
    score: i32,
    classification: String,
    recommendation: String,
    confidence: f64,
    modified_at: String,
    bucket: String,
    drive: String,
    is_hidden: bool,
    extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BucketSummary {
    bucket: String,
    label: String,
    file_count: u64,
    total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriveSummary {
    drive: String,
    label: String,
    file_count: u64,
    total_size: u64,
    hidden_count: u64,
    issue_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanIssue {
    path: String,
    kind: String,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanSession {
    id: String,
    root_paths: Vec<String>,
    status: String,
    phase: String,
    progress: f64,
    discovered_files: u64,
    processed_files: u64,
    bytes_scanned: u64,
    eta_seconds: Option<u64>,
    current_drive: Option<String>,
    current_path: Option<String>,
    start_time: Option<String>,
    end_time: Option<String>,
    error: Option<String>,
    summary: ScanSummary,
    drive_summaries: Vec<DriveSummary>,
    bucket_summaries: Vec<BucketSummary>,
    top_files: Vec<ScanResult>,
    oldest_file: Option<ScanResult>,
    newest_file: Option<ScanResult>,
    recent_findings: Vec<ScanResult>,
    issues: Vec<ScanIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanDetails {
    session: ScanSession,
    results: Vec<ScanResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AIAdvice {
    recommendation: String,
    confidence: f64,
    explanation: String,
    reasoning_signals: Vec<String>,
    similar_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolsetSettings {
    vscode: bool,
    android: bool,
    node: bool,
    python: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanningSettings {
    frequency: String,
    include_hidden: bool,
    follow_symlinks: bool,
    max_depth: Option<u32>,
    toolsets: ToolsetSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AISettings {
    enabled: bool,
    provider: String,
    model: String,
    base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppearanceSettings {
    theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    appearance: AppearanceSettings,
    ai: AISettings,
    scanning: ScanningSettings,
    exclusions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SidecarId {
    id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SystemInfo {
    platform: String,
    arch: String,
    version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriveInfo {
    id: String,
    path: String,
    label: String,
    file_system: String,
    total_bytes: u64,
    free_bytes: u64,
    used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedTarget {
    tool: String,
    label: String,
    path: String,
    exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SystemOverview {
    drives: Vec<DriveInfo>,
    managed_targets: Vec<ManagedTarget>,
    history_count: u64,
    active_scan_id: Option<String>,
    last_completed_scan_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssistantMatch {
    path: String,
    snippet: String,
    size: u64,
    modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssistantQueryResponse {
    query: String,
    answer: String,
    matches: Vec<AssistantMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteFilesRequest {
    file_paths: Vec<String>,
    mode: String,
}

struct AppState {
    client: Client,
    sidecar: Mutex<Option<Child>>,
    base_url: String,
}

impl AppState {
    fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(0)
            .timeout(Duration::from_secs(15))
            .build()
            .expect("failed to build HTTP client");
        Self {
            client,
            sidecar: Mutex::new(None),
            base_url: std::env::var("DEVSWEEP_API_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:9231".to_string()),
        }
    }
}

async fn ensure_sidecar(state: &AppState) -> Result<(), String> {
    if healthcheck(&state.client, &state.base_url).await.is_ok() {
        return Ok(());
    }

    {
        let mut guard = state.sidecar.lock().map_err(|error| error.to_string())?;
        let should_spawn = guard
            .as_mut()
            .map(|child| child.try_wait().ok().flatten().is_some())
            .unwrap_or(true);

        if should_spawn {
            *guard = Some(spawn_sidecar()?);
        }
    }

    for _ in 0..20 {
        if healthcheck(&state.client, &state.base_url).await.is_ok() {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }

    Err("The DevSweep sidecar did not become ready in time.".to_string())
}

async fn healthcheck(client: &Client, base_url: &str) -> Result<(), reqwest::Error> {
    client
        .get(format!("{base_url}/health"))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

fn spawn_sidecar() -> Result<Child, String> {
    if let Ok(binary) = std::env::var("DEVSWEEP_SIDECAR_BIN") {
        return Command::new(binary)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| error.to_string());
    }

    if cfg!(debug_assertions) {
        let core_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("core");
        let venv_python = if cfg!(target_os = "windows") {
            core_dir.join(".venv").join("Scripts").join("python.exe")
        } else {
            core_dir.join(".venv").join("bin").join("python")
        };
        let python_bin = if venv_python.exists() {
            venv_python
        } else {
            PathBuf::from("python")
        };
        return Command::new(python_bin)
            .arg("-m")
            .arg("devsweep.api")
            .current_dir(core_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| error.to_string());
    }

    let sidecar_name = if cfg!(target_os = "windows") {
        "devsweep-sidecar.exe"
    } else {
        "devsweep-sidecar"
    };

    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let candidate_paths = [
        executable
            .parent()
            .map(|directory| directory.join(sidecar_name)),
        executable.parent().and_then(|directory| {
            directory
                .parent()
                .map(|parent| parent.join("Resources").join(sidecar_name))
        }),
    ];

    for candidate in candidate_paths.into_iter().flatten() {
        if candidate.exists() {
            return Command::new(candidate)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|error| error.to_string());
        }
    }

    Command::new(sidecar_name)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn start_scan(request: ScanRequest, state: State<'_, AppState>) -> Result<String, String> {
    ensure_sidecar(&state).await?;
    let response = state
        .client
        .post(format!("{}/scan/start", state.base_url))
        .json(&request)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<SidecarId>()
        .await
        .map_err(|error| error.to_string())?;
    Ok(response.id)
}

#[tauri::command]
async fn stop_scan(scan_id: String, state: State<'_, AppState>) -> Result<(), String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .post(format!("{}/scan/{scan_id}/stop", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_scan_status(scan_id: String, state: State<'_, AppState>) -> Result<ScanSession, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/scan/{scan_id}", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<ScanSession>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_scan_results(scan_id: String, state: State<'_, AppState>) -> Result<ScanDetails, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/scan/{scan_id}/results", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<ScanDetails>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_history_scans(state: State<'_, AppState>) -> Result<Vec<ScanSession>, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/history/scans", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<Vec<ScanSession>>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_history_scan(scan_id: String, state: State<'_, AppState>) -> Result<ScanDetails, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/history/scans/{scan_id}", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<ScanDetails>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_ai_advice(file_path: String, state: State<'_, AppState>) -> Result<AIAdvice, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .post(format!("{}/ai/advice", state.base_url))
        .json(&serde_json::json!({ "filePath": file_path }))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<AIAdvice>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn learn_from_user_action(
    file_path: String,
    action: String,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .post(format!("{}/ai/learn", state.base_url))
        .json(&serde_json::json!({
            "filePath": file_path,
            "action": action,
            "reason": reason.unwrap_or_default(),
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn query_assistant(
    query: String,
    session_id: Option<String>,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AssistantQueryResponse, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .post(format!("{}/assistant/query", state.base_url))
        .json(&serde_json::json!({
            "query": query,
            "sessionId": session_id,
            "limit": limit.unwrap_or(8),
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<AssistantQueryResponse>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_files(
    file_paths: Vec<String>,
    mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    ensure_sidecar(&state).await?;
    let payload = DeleteFilesRequest {
        file_paths,
        mode: mode.unwrap_or_else(|| "recycle".to_string()),
    };
    state
        .client
        .post(format!("{}/files/delete", state.base_url))
        .json(&payload)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/settings", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<AppSettings>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<(), String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .put(format!("{}/settings", state.base_url))
        .json(&settings)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn test_ai_connection(state: State<'_, AppState>) -> Result<(), String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .post(format!("{}/settings/test-ai", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn clear_scan_history(state: State<'_, AppState>) -> Result<(), String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .delete(format!("{}/history/scans", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_system_drives(state: State<'_, AppState>) -> Result<Vec<DriveInfo>, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/system/drives", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<Vec<DriveInfo>>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_system_overview(state: State<'_, AppState>) -> Result<SystemOverview, String> {
    ensure_sidecar(&state).await?;
    state
        .client
        .get(format!("{}/system/overview", state.base_url))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<SystemOverview>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
fn open_file(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    open_path(path)
}

#[tauri::command]
fn show_in_folder(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    open_path(parent)
}

fn open_path(path: &Path) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        let path_string = path.to_string_lossy().to_string();
        Command::new("cmd")
            .args(["/C", "start", "", &path_string])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            clear_scan_history,
            delete_files,
            get_ai_advice,
            get_history_scan,
            get_history_scans,
            get_scan_results,
            get_scan_status,
            get_settings,
            get_system_drives,
            get_system_info,
            get_system_overview,
            learn_from_user_action,
            open_file,
            query_assistant,
            show_in_folder,
            start_scan,
            stop_scan,
            test_ai_connection,
            update_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
