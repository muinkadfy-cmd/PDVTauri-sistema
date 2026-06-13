
// ============================================================
//  Smart Tech PDV — Printer Management (Windows) for Tauri v2
//  Uses PowerShell Get-Printer / Set-Printer to:
//   - list printers
//   - get default printer
//   - set default printer
//
//  Notes:
//   - Windows only
//   - PowerShell exists by default on Windows 10/11
// ============================================================

use std::process::Command;
#[derive(serde::Serialize)]
pub struct PrinterInfo {
  pub name: String,
  pub is_default: bool,
}

fn run_powershell(script: &str) -> Result<String, String> {
  // ✅ P0: padroniza encoding (PowerShell/Windows costuma retornar em UTF-16/CP-1252)
  // para evitar stderr vazio / caracteres quebrados no JS.
  let wrapped = format!(
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [Console]::OutputEncoding; {}",
    script
  );

  let out = Command::new("powershell")
    .arg("-NoProfile")
    .arg("-ExecutionPolicy")
    .arg("Bypass")
    .arg("-Command")
    .arg(wrapped)
    .output()
    .map_err(|e| format!("powershell spawn failed: {e}"))?;

  if out.status.success() {
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
  } else {
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let msg = if !stderr.is_empty() { stderr } else { stdout };
    Err(format!(
      "powershell failed (code {:?}): {}",
      out.status.code(),
      msg
    ))
  }
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<PrinterInfo>, String> {
  // Outputs lines: Name|IsDefault
  let script = r#"
    $printers = Get-Printer | Select-Object Name, Default
    foreach ($p in $printers) {
      "$($p.Name)|$($p.Default)"
    }
  "#;

  let out = run_powershell(script)?;
  let mut res: Vec<PrinterInfo> = Vec::new();

  for line in out.lines() {
    let line = line.trim();
    if line.is_empty() { continue; }
    let mut parts = line.splitn(2, '|');
    let name = parts.next().unwrap_or("").trim().to_string();
    let def = parts.next().unwrap_or("False").trim().to_string();

    if name.is_empty() { continue; }
    let is_default = def.eq_ignore_ascii_case("True");
    res.push(PrinterInfo { name, is_default });
  }

  // Stable sort: default first, then name
  res.sort_by(|a,b| b.is_default.cmp(&a.is_default).then(a.name.cmp(&b.name)));
  Ok(res)
}

#[tauri::command]
pub async fn get_default_printer() -> Result<Option<String>, String> {
  let script = r#"
    $p = Get-Printer | Where-Object {$_.Default -eq $True} | Select-Object -First 1 -ExpandProperty Name
    if ($p) { $p } else { "" }
  "#;
  let out = run_powershell(script)?;
  let name = out.trim().to_string();
  if name.is_empty() { Ok(None) } else { Ok(Some(name)) }
}

#[tauri::command]
pub async fn set_default_printer(printer_name: String) -> Result<(), String> {
  // ✅ P1: Set-Printer varia por versão do módulo PrintManagement.
  // Tenta caminhos em ordem e cai para PrintUIEntry (bem compatível).
  // Escapar aspas simples (usamos string em aspas simples no PowerShell).
  let safe = printer_name.replace("'", "''");

  let script = format!(
    r#"
      $ErrorActionPreference = 'Stop'
      $name = '{}'
      try {{
        Set-Printer -Name $name -IsDefault $true
      }} catch {{
        try {{
          Set-Printer -Name $name -Default $true
        }} catch {{
          & rundll32.exe 'printui.dll,PrintUIEntry' /y /n $name | Out-Null
        }}
      }}
    "#,
    safe
  );

  let _ = run_powershell(&script)?;
  Ok(())
}
