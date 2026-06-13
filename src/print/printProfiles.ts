import { hydrateUiPref, readUiPrefLocal, setUiPref } from '@/lib/ui-prefs';

export type ThermalPreset = "58mm" | "80mm";

export interface PrintProfile {
  /** Thermal engine is fixed to ESC/POS raw for silent monochrome printing. */
  engine?: "escpos";
  printerName?: string;
  preset: ThermalPreset;
  // mm offsets to compensate printer hardware margins / cutter area
  offsetLeftMm: number;
  offsetTopMm: number;
  scale: number; // 1.0 default, adjust only if needed
}

// Default safe profile (Epson usually fine)
export const DEFAULT_PROFILE: PrintProfile = {
  engine: "escpos",
  preset: "80mm",
  offsetLeftMm: 0,
  offsetTopMm: 0,
  scale: 1,
};

const KEY = "stpdv_print_profile_v1";
let hydrationStarted = false;

function parseProfile(raw: string | null): PrintProfile {
  if (!raw) return DEFAULT_PROFILE;
  try {
    const obj = JSON.parse(raw);
    const engine = obj?.engine === "html" ? "escpos" : "escpos";
    return { ...DEFAULT_PROFILE, ...obj, engine };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function ensureDesktopHydration() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void hydrateUiPref(KEY);
}

export function loadPrintProfile(): PrintProfile {
  ensureDesktopHydration();
  return parseProfile(readUiPrefLocal(KEY, ''));
}

export function savePrintProfile(p: PrintProfile) {
  const raw = JSON.stringify(p);
  void setUiPref(KEY, raw);
}

/**
 * Wrap inner HTML in a mm-based container and apply calibration offsets.
 * Use with your printOrFallback() engine.
 */
export function applyProfile(innerHtml: string, profile: PrintProfile) {
  const width = profile.preset === "58mm" ? "58mm" : "80mm";
  const left = `${profile.offsetLeftMm}mm`;
  const top = `${profile.offsetTopMm}mm`;
  const scale = profile.scale || 1;

  return `
  <div style="
    width:${width};
    transform: translate(${left}, ${top}) scale(${scale});
    transform-origin: top left;
  ">
    ${innerHtml}
  </div>
  `;
}
