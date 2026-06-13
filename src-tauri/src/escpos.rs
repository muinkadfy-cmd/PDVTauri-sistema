//! ESC/POS native raw printing (Windows spooler).
//!
//! Goals:
//! - Print without dialog (silent/kiosk)
//! - Avoid DEV vs PROD layout differences (no HTML/PDF rendering)
//! - Allow precise control (cut, cash drawer, QR/logo via ESC/POS bytes)

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct EscposRawArgs {
  /// Optional printer name. If omitted, uses Windows default printer (PowerShell).
  #[serde(alias = "printerName")]
  pub printer_name: Option<String>,
  /// Optional spooler job name.
  #[serde(alias = "jobName")]
  pub job_name: Option<String>,
  /// How many copies to print. Defaults to 1.
  pub copies: Option<u32>,
  /// Base64 of RAW bytes to send to the printer (ESC/POS commands included).
  #[serde(alias = "dataBase64")]
  pub data_base64: String,
}

#[tauri::command]
pub async fn escpos_print_raw(args: EscposRawArgs) -> Result<(), String> {
  #[cfg(not(windows))]
  {
    let _ = args;
    return Err("escpos_print_raw is supported only on Windows.".to_string());
  }

  #[cfg(windows)]
  {
    use base64::Engine as _;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Graphics::Printing::{
      ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW, StartPagePrinter,
      WritePrinter, DOC_INFO_1W, PRINTER_HANDLE,
    };

    let copies = args.copies.unwrap_or(1).max(1);

    let bytes = base64::engine::general_purpose::STANDARD
      .decode(args.data_base64.as_bytes())
      .map_err(|e| format!("Invalid data_base64: {e}"))?;

    // Resolve printer name: provided -> default from PowerShell.
    let printer_name = match args.printer_name.as_deref() {
      Some(p) if !p.trim().is_empty() => p.to_string(),
      _ => {
        // Reuse existing PowerShell helper (Windows stable).
        crate::printers::get_default_printer()
          .await?
          .ok_or_else(|| "Nenhuma impressora configurada: selecione uma impressora em Configurações → Impressora ou defina uma impressora padrão no Windows.".to_string())?
      }
    };

    let job_name = args
      .job_name
      .as_deref()
      .filter(|s| !s.trim().is_empty())
      .unwrap_or("Smart Tech PDV (ESC/POS)")
      .to_string();

    // UTF-16 (Windows wide strings), null-terminated.
    let printer_w: Vec<u16> = printer_name.encode_utf16().chain(std::iter::once(0)).collect();
    let job_w: Vec<u16> = job_name.encode_utf16().chain(std::iter::once(0)).collect();
    let raw_w: Vec<u16> = "RAW".encode_utf16().chain(std::iter::once(0)).collect();

    unsafe {
      let mut h_printer = PRINTER_HANDLE::default();

      OpenPrinterW(
        PCWSTR(printer_w.as_ptr()),
        &mut h_printer as *mut PRINTER_HANDLE,
        None,
      )
      .map_err(|e| format!("OpenPrinterW failed for '{printer_name}': {e}"))?;

      // Ensure handle closes.
      struct PrinterGuard(PRINTER_HANDLE);
      impl Drop for PrinterGuard {
        fn drop(&mut self) {
          unsafe {
            let _ = ClosePrinter(self.0);
          }
        }
      }
      let _guard = PrinterGuard(h_printer);

      let mut doc_info = DOC_INFO_1W {
        pDocName: PWSTR(job_w.as_ptr() as *mut _),
        pOutputFile: PWSTR::null(),
        pDatatype: PWSTR(raw_w.as_ptr() as *mut _),
      };

      for _ in 0..copies {
        let started = StartDocPrinterW(h_printer, 1, &mut doc_info as *mut _ as *mut _);
        if started == 0 {
          return Err("StartDocPrinterW failed.".to_string());
        }

        if !StartPagePrinter(h_printer).as_bool() {
          let _ = EndDocPrinter(h_printer);
          return Err("StartPagePrinter failed.".to_string());
        }

        let mut written: u32 = 0;
        if !WritePrinter(
          h_printer,
          bytes.as_ptr() as *const _,
          bytes.len() as u32,
          &mut written,
        )
        .as_bool()
        {
          let _ = EndPagePrinter(h_printer);
          let _ = EndDocPrinter(h_printer);
          return Err("WritePrinter failed.".to_string());
        }

        if written as usize != bytes.len() {
          let _ = EndPagePrinter(h_printer);
          let _ = EndDocPrinter(h_printer);
          return Err(format!("WritePrinter wrote {written} bytes, expected {}.", bytes.len()));
        }

        if !EndPagePrinter(h_printer).as_bool() {
          let _ = EndDocPrinter(h_printer);
          return Err("EndPagePrinter failed.".to_string());
        }

        if !EndDocPrinter(h_printer).as_bool() {
          return Err("EndDocPrinter failed.".to_string());
        }
      }
    }

    Ok(())
  }
}
