
TOP PACK — Printer Selection + Calibration + Universal Templates

WHAT THIS ADDS:
1) Windows printer listing + set default printer (PowerShell) in Rust:
   - src-tauri/src/printers.rs

2) Frontend printer API:
   - src/utils/printers.ts

3) Calibration profiles (offsets / scale / 58-80mm preset) persisted in localStorage:
   - src/print/printProfiles.ts

4) Universal printable templates (receipt / OS / label):
   - src/print/templates.ts

5) Settings UI component to choose printer + calibrate:
   - src/components/PrinterSettings.tsx

INTEGRATION (TAURI):
A) In src-tauri/src/lib.rs:
   add:
     mod printers;

   and in invoke_handler:
     printers::list_printers,
     printers::get_default_printer,
     printers::set_default_printer,

B) Ensure your silent print command supports printer_name (from NextPack / enhanced print.rs).

FRONTEND USAGE:
- Load profile:
    const profile = loadPrintProfile();

- Build inner HTML (receipt/os/label):
    const inner = receiptInnerHTML(...);

- Apply calibration:
    const calibratedInner = applyProfile(inner, profile);

- Print:
    await printOrFallback(calibratedInner, {
      preset: profile.preset,
      printerName: profile.printerName,
      jobName: "Recibo"
    });

WHERE TO PLACE UI:
- Add <PrinterSettings /> in your Configurações > Impressão screen.

NOTES:
- PowerShell printer management is Windows-only.
- If some environments block PowerShell, you can switch to native WinAPI later.
