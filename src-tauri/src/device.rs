use std::{fs, io::Write, path::PathBuf};
use tauri::Manager;

/// Retorna o caminho canônico do device_id.txt dentro do AppData (Roaming) do app.
fn device_id_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir error: {e}"))?;
    base.push("secure");
    fs::create_dir_all(&base).map_err(|e| format!("create secure dir error: {e}"))?;
    Ok(base.join("device_id.txt"))
}

fn is_valid_device_id(s: &str) -> bool {
    let s = s.trim();
    // Formato aceito: device-<uuid-v4> (ou qualquer token >= 16 chars)
    s.starts_with("device-") && s.len() >= 16 && !s.contains('\n') && !s.contains('\r')
}

/// Gera um ID estável (sem timestamp). Ex.: device-84f7b596f709d317927793df85dbbafb
fn generate_device_id() -> String {
    format!("device-{}", uuid::Uuid::new_v4())
}

/// Escrita atômica: escreve tmp e renomeia, reduz risco de arquivo corrompido.
fn atomic_write(path: &PathBuf, data: &str) -> Result<(), String> {
    let dir = path.parent().ok_or("invalid device_id path")?;
    let tmp = dir.join("device_id.tmp");

    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("create tmp error: {e}"))?;
        f.write_all(data.as_bytes()).map_err(|e| format!("write tmp error: {e}"))?;
        f.sync_all().map_err(|e| format!("sync tmp error: {e}"))?;
    }

    fs::rename(&tmp, path).map_err(|e| format!("rename tmp error: {e}"))?;
    Ok(())
}

/// Fonte única (canônica) do Device ID no Desktop.
///
/// - Lê de AppData\Roaming\...\secure\device_id.txt
/// - Se não existir (ou inválido), gera UUID e grava com escrita atômica
/// - Nunca usa timestamp
#[tauri::command]
pub fn get_or_create_device_id(app: tauri::AppHandle) -> Result<String, String> {
    let path = device_id_path(&app)?;

    if let Ok(s) = fs::read_to_string(&path) {
        let id = s.trim().to_string();
        if is_valid_device_id(&id) {
            return Ok(id);
        }
    }

    let id = generate_device_id();
    atomic_write(&path, &id)?;
    Ok(id)
}
