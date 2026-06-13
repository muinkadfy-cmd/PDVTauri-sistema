import { isDesktopApp } from '@/lib/platform';

export interface NativeSilentPrintArgs {
  html: string;
  jobName?: string;
  printerName?: string;
  copies?: number;
}

export function canUseNativeSilentPrint(): boolean {
  return isDesktopApp();
}

export async function silentPrintHtml(
  args: NativeSilentPrintArgs
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  if (!canUseNativeSilentPrint()) {
    return {
      ok: false,
      error: new Error('Impressão silenciosa nativa indisponível fora do desktop.')
    };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('silent_print_html', {
      args: {
        html: args.html,
        job_name: args.jobName,
        printer_name: args.printerName,
        copies: args.copies ?? 1
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function openPrintPreviewWindow(features: string = 'width=420,height=600'): Window | null {
  try {
    return window.open('', '_blank', features);
  } catch {
    return null;
  }
}
