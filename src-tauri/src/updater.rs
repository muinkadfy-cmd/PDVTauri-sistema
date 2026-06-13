use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdaterConfig {
    pub endpoints: Vec<String>,
    pub pubkey: String,
    pub target: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
    pub target: Option<String>,
    pub download_url: Option<String>,
}

fn normalize_config(config: DesktopUpdaterConfig) -> Result<DesktopUpdaterConfig, String> {
    let endpoints = config
        .endpoints
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();

    let pubkey = config.pubkey.trim().to_string();
    if endpoints.is_empty() {
        return Err("Nenhum endpoint de atualização foi configurado.".into());
    }
    if pubkey.is_empty() {
        return Err("A chave pública do updater não foi configurada.".into());
    }

    Ok(DesktopUpdaterConfig {
        endpoints,
        pubkey,
        target: config
            .target
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        timeout_ms: config.timeout_ms.filter(|value| *value > 0),
    })
}

fn build_updater(
    app: &AppHandle,
    config: DesktopUpdaterConfig,
) -> Result<tauri_plugin_updater::Updater, String> {
    let config = normalize_config(config)?;
    let endpoints = config
        .endpoints
        .iter()
        .map(|value| Url::parse(value).map_err(|_| format!("Endpoint inválido: {value}")))
        .collect::<Result<Vec<_>, _>>()?;

    let mut builder = app
        .updater_builder()
        .pubkey(config.pubkey)
        .endpoints(endpoints)
        .map_err(|err| err.to_string())?;

    if let Some(target) = config.target {
        builder = builder.target(target);
    }

    if let Some(timeout_ms) = config.timeout_ms {
        builder = builder.timeout(Duration::from_millis(timeout_ms));
    }

    builder.build().map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn desktop_check_update(
    app: AppHandle,
    config: DesktopUpdaterConfig,
) -> Result<DesktopUpdateInfo, String> {
    let updater = build_updater(&app, config)?;
    let current_version = app.package_info().version.to_string();
    let maybe_update = updater.check().await.map_err(|err| err.to_string())?;

    if let Some(update) = maybe_update {
        return Ok(DesktopUpdateInfo {
            available: true,
            current_version,
            version: Some(update.version.to_string()),
            body: update.body,
            date: update.date.map(|date| date.to_string()),
            target: Some(update.target.to_string()),
            download_url: Some(update.download_url.to_string()),
        });
    }

    Ok(DesktopUpdateInfo {
        available: false,
        current_version,
        version: None,
        body: None,
        date: None,
        target: None,
        download_url: None,
    })
}

#[tauri::command]
pub async fn desktop_install_update(
    app: AppHandle,
    config: DesktopUpdaterConfig,
) -> Result<(), String> {
    let updater = build_updater(&app, config)?;
    let maybe_update = updater.check().await.map_err(|err| err.to_string())?;
    let update = maybe_update.ok_or_else(|| "Nenhuma atualização disponível no momento.".to_string())?;

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| err.to_string())
}
