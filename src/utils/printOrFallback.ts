import { openPrintPreviewWindow, silentPrintHtml } from '@/lib/capabilities/print-adapter';

/**
 * Paper presets for thermal printers.
 * You can add more if needed.
 */
export type ThermalPreset = "58mm" | "80mm";

export interface SilentPrintOptions {
  /** Optional job name (helps identify in spooler logs). */
  jobName?: string;
  /** If provided, tries to force printing to this printer name via Sumatra. */
  printerName?: string;
  /** Number of copies (Sumatra uses -print-settings "copies=2"). */
  copies?: number;
  /** Thermal width preset. */
  preset?: ThermalPreset;
  /** If true, fallback to window.print() when silent printing fails. Default true. */
  fallbackToDialog?: boolean;
}

/**
 * Wraps your inner HTML (card/receipt/os) in a spooler-safe, mm-based container,
 * preventing driver auto-scaling issues (DEV == PROD).
 *
 * IMPORTANT: Put only the inside of the printable area in `inner`.
 */
export function buildThermalHtml(inner: string, preset: ThermalPreset = "80mm") {
  const width = preset === "58mm" ? "58mm" : "80mm";

  // Avoid relying on @page; many drivers ignore it or apply their own margins.
  const css = `
  <style>
    *{ box-sizing:border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    html,body{ margin:0; padding:0; background:#fff; }
    /* Centers the print-root and prevents printer scaling. */
    .print-wrapper{ display:flex; justify-content:center; align-items:flex-start; width:100%; }
    .print-root{ width:${width}; }
  </style>
  `;

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      ${css}
    </head>
    <body>
      <div class="print-wrapper">
        <div class="print-root">
          ${inner}
        </div>
      </div>
    </body>
  </html>
  `;
}

/**
 * Calls native silent print (Windows) and optionally falls back to the print dialog.
 * Requires Rust command `silent_print_html` (provided in previous zip / nextpack rust file).
 */
export async function printOrFallback(html: string, opts: SilentPrintOptions = {}) {
  const {
    jobName,
    printerName,
    copies = 1,
    preset = "80mm",
    fallbackToDialog = true,
  } = opts;

  const wrapped = buildThermalHtml(html, preset);

  const silentResult = await silentPrintHtml({
    html: wrapped,
    jobName,
    printerName,
    copies
  });

  if (silentResult.ok) {
    return { ok: true as const };
  }

  const e = silentResult.error;
  if (!fallbackToDialog) return { ok: false as const, error: e };

  // Fallback: open a normal print window
  const win = openPrintPreviewWindow("width=420,height=600");
  if (!win) return { ok: false as const, error: e };

  win.document.write(wrapped);
  win.document.close();
  win.onload = () => {
    win.document.body.style.zoom = "1";
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => win.close(), 300);
    }, 250);
  };
  return { ok: false as const, error: e, usedFallback: true as const };
}
