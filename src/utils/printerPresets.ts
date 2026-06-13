
/**
 * Optional: map known printer models to recommended paper preset.
 * This is manual, because most environments cannot reliably auto-detect paper width.
 *
 * Use:
 *   const preset = guessThermalPreset(config.printerName);
 */
import type { ThermalPreset } from "@/utils/printOrFallback";

export function guessThermalPreset(printerName?: string): ThermalPreset {
  const n = (printerName || "").toLowerCase();

  // Epson TM-T20 often used with 80mm; some shops use 58mm roll.
  if (n.includes("tm-t20")) return "80mm";
  if (n.includes("tm-t88")) return "80mm";
  if (n.includes("58")) return "58mm";
  if (n.includes("80")) return "80mm";

  return "80mm";
}
