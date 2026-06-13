import { isDesktopApp } from '@/lib/platform';

export type NativePrinterInfo = { name: string; is_default: boolean };

export async function listNativePrinters(): Promise<unknown> {
  if (!isDesktopApp()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<unknown>('list_printers');
}

export async function getNativeDefaultPrinter(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string | null>('get_default_printer');
}

export async function setNativeDefaultPrinter(printerName: string): Promise<void> {
  if (!isDesktopApp()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_default_printer', { printerName });
}

export async function escposPrintRawNative(args: {
  jobName?: string;
  printerName?: string;
  copies?: number;
  dataBase64: string;
}): Promise<void> {
  if (!isDesktopApp()) {
    throw new Error('ESC/POS nativo disponível apenas no desktop.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('escpos_print_raw', {
    args: {
      jobName: args.jobName,
      printerName: args.printerName,
      copies: args.copies ?? 1,
      dataBase64: args.dataBase64
    }
  });
}
