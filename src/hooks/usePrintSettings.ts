import { useEffect, useState } from 'react';
import {
  buildThermalSettingsFromProfile,
  loadThermalPrintSettings,
  saveThermalPrintSettings,
  type ThermalPrintSettings,
} from '@/services/print/settings';
import { type ThermalPrinterProfileId } from '@/services/print/thermalProfiles';

export function usePrintSettings() {
  const [settings, setSettings] = useState<ThermalPrintSettings>(() => loadThermalPrintSettings());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(loadThermalPrintSettings());
  }, []);

  async function persist(next: ThermalPrintSettings) {
    setSettings(next);
    setSaving(true);
    try {
      await saveThermalPrintSettings(next);
    } finally {
      setSaving(false);
    }
  }

  async function update(patch: Partial<ThermalPrintSettings>) {
    const next = { ...settings, ...patch };
    await persist(next);
  }

  async function applyProfile(profileId: ThermalPrinterProfileId) {
    const base = buildThermalSettingsFromProfile(profileId);
    await persist({
      ...base,
      ...settings,
      printerProfile: base.printerProfile,
      usefulWidthMm: base.usefulWidthMm,
      innerMarginMm: base.innerMarginMm,
      fontSizePx: base.fontSizePx,
      lineHeight: base.lineHeight,
      showLogo: settings.showLogo,
      showQrCode: settings.showQrCode,
      showFooterCut: settings.showFooterCut,
      autoCloseAfterPrint: settings.autoCloseAfterPrint,
      paperWidth: settings.paperWidth,
      backend: settings.backend,
      printDensity: settings.printDensity,
    });
  }

  async function saveCurrent() {
    await persist({ ...settings });
  }

  return {
    settings,
    saving,
    update,
    applyProfile,
    saveCurrent,
    reload: () => setSettings(loadThermalPrintSettings()),
  };
}
