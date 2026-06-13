// ============================================================
//  Smart Tech PDV — Tauri Application Core (lib.rs)
// ============================================================
//
//  LOGGING STRATEGY (por que importa para o console):
//
//  O tauri_plugin_log por padrão adiciona um Target::Stdout
//  quando nenhum target é especificado explicitamente.
//  Esse target mantém um handle para stdout/stderr aberto,
//  o que em algumas versões do Windows runtime faz o sistema
//  alocar uma janela de console mesmo com subsystem=windows.
//
//  Solução: em release, logar APENAS para arquivo (LogDir).
//           em debug, adicionar Stdout para ver logs no terminal.
//
//  Resultado:
//    cargo tauri build          → sem console, sem janela preta
//    cargo tauri dev            → console disponível, logs visíveis

use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};

mod print;
mod escpos;
mod printers;
mod updater;

mod device;
#[cfg_attr(all(mobile, not(debug_assertions)), tauri::mobile_entry_point)]
pub fn run() {
    // ── Logging: arquivo em release, arquivo+stdout em debug ──────────
    let log_plugin = {
        let builder = LogBuilder::new()
            .level(log::LevelFilter::Info)
            // Target 1: sempre logar em arquivo (AppData/Roaming/.../logs/)
            .target(Target::new(TargetKind::LogDir {
                file_name: Some("smart-tech-pdv".to_string()),
            }));

        // Target 2: stdout apenas em debug — não incluir em release
        // Isso garante que nenhum handle de console é aberto no build final
        #[cfg(debug_assertions)]
        let builder = builder.target(Target::new(TargetKind::Stdout));

        builder.build()
    };

    tauri::Builder::default()
        .plugin(log_plugin)
        // SQLite via rusqlite (SQLCipher)
        .plugin(tauri_plugin_rusqlite2::Builder::default().build())
        // Dialog + FS (Backup/Restore + anexos em disco)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Abrir links externos (ex: WhatsApp) no navegador padrão
        .plugin(tauri_plugin_shell::init())
        // Auto-update nativo: o plugin precisa estar registrado para
        // app.updater_builder() ter estado interno. Endpoint/pubkey continuam
        // vindo da config temporária gerada pelos scripts de release.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Iniciar já maximizado
        .setup(|app| {
            #[cfg(not(mobile))]
            {
                use tauri::Manager;
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.maximize();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            print::silent_print_html,
            escpos::escpos_print_raw,
            printers::list_printers,
            printers::get_default_printer,
            printers::set_default_printer,
            device::get_or_create_device_id,
            updater::desktop_check_update,
            updater::desktop_install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
