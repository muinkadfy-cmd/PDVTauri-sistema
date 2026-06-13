export type ThermalPaperWidth = '58' | '80';

export type ThermalPrinterProfileId =
  | 'generic-pos-58'
  | 'generic-pos-80'
  | 'epson-tm-t20'
  | 'goldensky-58';

export interface ThermalPrinterProfile {
  id: ThermalPrinterProfileId;
  label: string;
  defaultPaperWidth: ThermalPaperWidth;
  usefulWidthMm: number;
  innerMarginMm: number;
  fontSizePx: number;
  lineHeight: number;
}

export const THERMAL_PRINTER_PROFILES: Record<ThermalPrinterProfileId, ThermalPrinterProfile> = {
  'generic-pos-58': {
    id: 'generic-pos-58',
    label: 'POS-58 / Genérica 58mm',
    defaultPaperWidth: '58',
    usefulWidthMm: 48,
    innerMarginMm: 2,
    fontSizePx: 11,
    lineHeight: 1.22,
  },
  'generic-pos-80': {
    id: 'generic-pos-80',
    label: 'Genérica 80mm',
    defaultPaperWidth: '80',
    usefulWidthMm: 72,
    innerMarginMm: 2,
    fontSizePx: 12,
    lineHeight: 1.24,
  },
  'epson-tm-t20': {
    id: 'epson-tm-t20',
    label: 'Epson TM-T20',
    defaultPaperWidth: '80',
    usefulWidthMm: 72,
    innerMarginMm: 2,
    fontSizePx: 12,
    lineHeight: 1.22,
  },
  'goldensky-58': {
    id: 'goldensky-58',
    label: 'Goldensky / Gprinter 58mm',
    defaultPaperWidth: '58',
    usefulWidthMm: 48,
    innerMarginMm: 1.5,
    fontSizePx: 11,
    lineHeight: 1.18,
  },
};

export function getThermalPrinterProfile(profileId?: string | null): ThermalPrinterProfile {
  if (profileId && profileId in THERMAL_PRINTER_PROFILES) {
    return THERMAL_PRINTER_PROFILES[profileId as ThermalPrinterProfileId];
  }
  return THERMAL_PRINTER_PROFILES['generic-pos-58'];
}

export function detectThermalPrinterBrand(printerName?: string | null): string {
  const raw = String(printerName ?? '').trim();
  const normalized = raw.toLowerCase();

  if (!raw) return 'Marca/modelo ainda não identificado';
  if (normalized.includes('epson') || normalized.includes('tm-t20')) return 'Identificação provável: Epson TM-T20';
  if (normalized.includes('goldensky') || normalized.includes('gprinter') || normalized.includes('gp-')) return 'Identificação provável: Goldensky / Gprinter';
  if (normalized.includes('pos-58') || normalized.includes('58mm')) return 'Identificação provável: impressora térmica 58mm';
  if (normalized.includes('pos-80') || normalized.includes('80mm')) return 'Identificação provável: impressora térmica 80mm';

  return `Modelo detectado pelo nome do Windows: ${raw}`;
}
