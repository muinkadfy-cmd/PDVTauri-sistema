import { hydrateUiPref, readUiPrefLocal, setUiPref } from '@/lib/ui-prefs';
import { isDesktopApp } from '@/lib/platform';
import { getRuntimeStoreIdOrDefault } from '@/lib/runtime-context';
import { loadPrintProfile, savePrintProfile } from '@/print/printProfiles';
import { getThermalPrinterProfile, type ThermalPaperWidth, type ThermalPrinterProfileId } from './thermalProfiles';

export type ThermalPrintBackend = 'browser-route' | 'native-escpos';

export interface ThermalPrintSettings {
  paperWidth: ThermalPaperWidth;
  printerProfile: ThermalPrinterProfileId;
  backend: ThermalPrintBackend;
  usefulWidthMm: number;
  innerMarginMm: number;
  fontSizePx: number;
  lineHeight: number;
  printDensity: 'compact' | 'normal' | 'dense';
  showLogo: boolean;
  showQrCode: boolean;
  showFooterCut: boolean;
  autoCloseAfterPrint: boolean;
}

export const THERMAL_PRINT_SETTINGS_KEY = 'smart-tech-thermal-print-settings-v1';
const LEGACY_PAPER_KEY = 'smart-tech-tamanho-papel';

let hydrationStarted = false;

function getThermalSettingsStorageKey(): string {
  return `${THERMAL_PRINT_SETTINGS_KEY}:${getRuntimeStoreIdOrDefault('default')}`;
}

export const DEFAULT_THERMAL_PRINT_SETTINGS: ThermalPrintSettings = {
  paperWidth: '58',
  printerProfile: 'generic-pos-58',
  backend: isDesktopApp() ? 'native-escpos' : 'browser-route',
  usefulWidthMm: 48,
  innerMarginMm: 2,
  fontSizePx: 11,
  lineHeight: 1.22,
  printDensity: 'normal',
  showLogo: true,
  showQrCode: false,
  showFooterCut: true,
  autoCloseAfterPrint: true,
};

function ensureHydration() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void hydrateUiPref(THERMAL_PRINT_SETTINGS_KEY);
  void hydrateUiPref(getThermalSettingsStorageKey());
}

function normalizeSettings(raw: Partial<ThermalPrintSettings> | null | undefined): ThermalPrintSettings {
  const profile = getThermalPrinterProfile(raw?.printerProfile);
  const paperWidth = raw?.paperWidth === '80' ? '80' : raw?.paperWidth === '58' ? '58' : profile.defaultPaperWidth;
  const backend = raw?.backend === 'browser-route' || raw?.backend === 'native-escpos'
    ? raw.backend
    : (isDesktopApp() ? 'native-escpos' : 'browser-route');

  return {
    ...DEFAULT_THERMAL_PRINT_SETTINGS,
    ...raw,
    paperWidth,
    printerProfile: profile.id,
    backend,
    usefulWidthMm: Number(raw?.usefulWidthMm) > 0 ? Number(raw?.usefulWidthMm) : profile.usefulWidthMm,
    innerMarginMm: Number(raw?.innerMarginMm) >= 0 ? Number(raw?.innerMarginMm) : profile.innerMarginMm,
    fontSizePx: Number(raw?.fontSizePx) >= 8 ? Number(raw?.fontSizePx) : profile.fontSizePx,
    lineHeight: Number(raw?.lineHeight) >= 1 ? Number(raw?.lineHeight) : profile.lineHeight,
    printDensity: raw?.printDensity === 'compact' || raw?.printDensity === 'dense' ? raw.printDensity : 'normal',
    showLogo: raw?.showLogo ?? DEFAULT_THERMAL_PRINT_SETTINGS.showLogo,
    showQrCode: raw?.showQrCode ?? DEFAULT_THERMAL_PRINT_SETTINGS.showQrCode,
    showFooterCut: raw?.showFooterCut ?? DEFAULT_THERMAL_PRINT_SETTINGS.showFooterCut,
    autoCloseAfterPrint: raw?.autoCloseAfterPrint ?? DEFAULT_THERMAL_PRINT_SETTINGS.autoCloseAfterPrint,
  };
}

export function loadThermalPrintSettings(): ThermalPrintSettings {
  ensureHydration();
  const scopedKey = getThermalSettingsStorageKey();
  const raw = readUiPrefLocal(scopedKey, '') || readUiPrefLocal(THERMAL_PRINT_SETTINGS_KEY, '');
  if (!raw) return DEFAULT_THERMAL_PRINT_SETTINGS;
  try {
    return normalizeSettings(JSON.parse(raw) as Partial<ThermalPrintSettings>);
  } catch {
    return DEFAULT_THERMAL_PRINT_SETTINGS;
  }
}

export async function saveThermalPrintSettings(settings: ThermalPrintSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const serialized = JSON.stringify(normalized);
  await setUiPref(getThermalSettingsStorageKey(), serialized);
  await setUiPref(THERMAL_PRINT_SETTINGS_KEY, serialized);

  const legacyPaper = normalized.paperWidth === '80' ? '80mm' : '58mm';
  await setUiPref(LEGACY_PAPER_KEY, legacyPaper);

  const legacyProfile = loadPrintProfile();
  savePrintProfile({
    ...legacyProfile,
    preset: normalized.paperWidth === '80' ? '80mm' : '58mm',
  });
}

export function buildThermalSettingsFromProfile(profileId: ThermalPrinterProfileId): ThermalPrintSettings {
  const profile = getThermalPrinterProfile(profileId);
  return normalizeSettings({
    ...DEFAULT_THERMAL_PRINT_SETTINGS,
    paperWidth: profile.defaultPaperWidth,
    printerProfile: profile.id,
    usefulWidthMm: profile.usefulWidthMm,
    innerMarginMm: profile.innerMarginMm,
    fontSizePx: profile.fontSizePx,
    lineHeight: profile.lineHeight,
  });
}
