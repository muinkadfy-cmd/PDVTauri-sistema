import { isDesktopApp } from '@/lib/platform';
import { diagLog } from '@/lib/telemetry/diag-log';
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

function shouldForceSilentServiceOrder(request: PrintReceiptRequest): boolean {
  // Regra comercial: O.S. térmica nunca deve abrir rota/janela de navegador.
  // O layout Premium precisa sair pelo motor silencioso RAW ESC/POS no Desktop.
  return request.type === 'service-order';
}

async function printResolvedReceipt(request: PrintReceiptRequest) {
  const settings = loadThermalPrintSettings();
  const paperWidth = request.paperWidth ?? settings.paperWidth;
  const thermalMode = getThermalMode(settings);
  const resolved = await resolveReceiptPrintData(request.type, request.id);
  if (!resolved) throw new Error('Documento de impressão não encontrado.');

  const forceSilentServiceOrder = shouldForceSilentServiceOrder(request);
  const useBrowserRoute = settings.backend === 'browser-route' && !forceSilentServiceOrder;

  if (isDesktopApp() && !useBrowserRoute) {
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

export interface PrintTestOptions {
  paperWidth?: '58' | '80';
  label?: string;
}

export async function openPrintTest(options: PrintTestOptions = {}): Promise<void> {
  const paperWidth = options.paperWidth;
  const label = options.label || (paperWidth ? `${paperWidth}mm` : 'padrão');
  try {
    diagLog('info', '[Print] Teste de impressão iniciado', { label, paperWidth });
    await printResolvedReceipt({ type: 'test', id: 'sample', ...(paperWidth ? { paperWidth } : {}) });
    diagLog('info', '[Print] Teste de impressão enviado', { label, paperWidth });
  } catch (error) {
    console.error('[Print] Teste térmico falhou:', error);
    const message = error instanceof Error ? error.message : String(error);
    diagLog('error', '[Print] Teste térmico falhou', { label, paperWidth, message });
    alert(
      'Não foi possível imprimir o cupom de teste.\n\n' +
      `${message}\n\n` +
      'Confira a impressora configurada no desktop e tente novamente. A versão atual continua funcionando e nenhum dado foi alterado.'
    );
    throw error;
  }
}

export function openPrintPreviewTest(options: PrintTestOptions = {}): void {
  const route = buildPrintRoute({
    type: 'test',
    id: 'sample',
    ...(options.paperWidth ? { paperWidth: options.paperWidth } : {})
  });
  const win = window.open(route, '_blank', 'width=420,height=720');
  if (!win) {
    throw new Error('O navegador bloqueou a janela de prévia. Permita pop-ups para testar a impressão.');
  }
}

export async function printReceipt(request: PrintReceiptRequest): Promise<void> {
  try {
    await printResolvedReceipt(request);
  } catch (error) {
    console.error('[Print] Falha ao imprimir recibo:', error);
    diagLog('error', '[Print] Falha ao imprimir recibo', {
      type: request.type,
      id: request.id,
      paperWidth: request.paperWidth,
      message: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : String(error);
    alert(
      'Impressão térmica indisponível no momento.\n\n' +
      `${message}\n\n` +
      'Verifique a impressora configurada no desktop e tente novamente.'
    );
  }
}
