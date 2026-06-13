import { isDesktopApp } from '@/lib/platform';
import { printDocument } from '@/lib/print-template';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { loadThermalPrintSettings, type ThermalPrintSettings } from './settings';
import { resolveReceiptPrintData, type PrintableReceiptType } from './receipt-builders';

export interface PrintReceiptRequest {
  type: PrintableReceiptType;
  id: string;
  paperWidth?: '58' | '80';
  printerProfile?: string;
}

function getThermalMode(settings: ThermalPrintSettings) {
  return settings.printDensity === 'compact' ? 'compact' : 'normal';
}

async function printResolvedReceipt(request: PrintReceiptRequest) {
  const settings = loadThermalPrintSettings();
  const paperWidth = request.paperWidth ?? settings.paperWidth;
  const thermalMode = getThermalMode(settings);
  const resolved = await resolveReceiptPrintData(request.type, request.id);
  if (!resolved) throw new Error('Documento de impressão não encontrado.');

  if (isDesktopApp()) {
    printDocument(resolved.printData, {
      paperSize: paperWidth === '80' ? '80mm' : '58mm',
      printMode: thermalMode,
    });
    return;
  }

  const route = buildPrintRoute(request);
  if (typeof window !== 'undefined') {
    window.location.href = route;
    return;
  }

  throw new Error('Impressão indisponível fora do ambiente com janela.');
}

function buildPrintRoute(request: PrintReceiptRequest) {
  const settings = loadThermalPrintSettings();
  const paper = request.paperWidth ?? settings.paperWidth;
  const profile = request.printerProfile ?? settings.printerProfile;
  const storeId = getRuntimeStoreId();
  const params = new URLSearchParams({
    paper,
    profile,
  });
  if (storeId) params.set('store', storeId);
  if (typeof window !== 'undefined') {
    params.set('returnTo', `${window.location.pathname}${window.location.search}`);
  }
  return `/print/${request.type}/${encodeURIComponent(request.id)}?${params.toString()}`;
}

export function openPrintTest(): void {
  void printResolvedReceipt({ type: 'test', id: 'sample' }).catch((error) => {
    console.error('[Print] Teste térmico falhou:', error);
    const message = error instanceof Error ? error.message : String(error);
    alert(
      'Falha ao imprimir o cupom de teste.\n\n' +
      `${message}\n\n` +
      'Confira a impressora configurada no desktop e tente novamente.'
    );
  });
}

export async function printReceipt(request: PrintReceiptRequest): Promise<void> {
  try {
    await printResolvedReceipt(request);
  } catch (error) {
    console.error('[Print] Falha ao imprimir recibo:', error);
    const message = error instanceof Error ? error.message : String(error);
    alert(
      'Impressão térmica indisponível no momento.\n\n' +
      `${message}\n\n` +
      'Verifique a impressora configurada no desktop e tente novamente.'
    );
  }
}
