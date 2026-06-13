import JSZip from 'jszip';
import { BUILD_COMMIT, BUILD_DATE, BUILD_ID, BUILD_VERSION } from '@/config/buildInfo';
import { getDeviceId } from '@/lib/device';
import { getLicenseStatusAsync } from '@/lib/license';
import { getDesktopErrors } from '@/lib/desktop/error-capture';
import { exportCrashLog, getCrashLogCount } from '@/lib/crash-report';
import { isDesktopApp } from '@/lib/platform';
import { getPerfSnapshot } from '@/lib/perf';
import { getLastSelfTest } from '@/lib/self-test';
import { logger } from '@/utils/logger';
import { getDiagLogs } from '@/lib/telemetry/diag-log';
import { getPersistenceInfo } from '@/lib/persistence-info';
import { downloadBlobInBrowser, saveBlobWithDialog } from '@/lib/capabilities/file-save-adapter';
import { getDesktopPaths } from '@/lib/capabilities/desktop-path-adapter';
import { readDesktopDir, readDesktopFileBytes, statDesktopPathSafe } from '@/lib/capabilities/desktop-fs-adapter';

const TESTE_EXTREMO_MD = `# Teste extremo (Passo 10) — PDV Offline

Roteiro para validar velocidade (PC fraco), offline, impressão e backup.

1) Login → Painel → Clientes (digitar 10–15s) → Produtos (digitar 10–15s) → Vendas → Ordens.
2) Teste com internet desligada (criar cliente/produto/venda/OS).
3) Imprima (A4 e/ou térmica) e valide cortes/margens.
4) Faça Backup e confirme o arquivo.
5) Ajuda → Auto-teste → Baixar Pacote de Suporte.
`;

async function saveBlobDesktop(blob: Blob, filename: string): Promise<boolean> {
  const ok = await saveBlobWithDialog(blob, {
    filename,
    filters: [{ name: 'Suporte Smart Tech', extensions: ['zip'] }],
    allowedExtensions: ['zip']
  });
  if (!ok) {
    logger.warn('[SupportPack] Falha ao salvar via dialog/fs (desktop).');
  }
  return ok;
}


async function collectDesktopLogs(): Promise<Array<{ name: string; text: string }>> {
  if (!isDesktopApp()) return [];
  try {
    const paths = await getDesktopPaths();
    const dir = paths.appLogDir || '';
    if (!dir) return [];
    const entries = await readDesktopDir(dir).catch(() => []);
    const out: Array<{ name: string; text: string }> = [];

    for (const e of (entries || [])) {
      const name = (e as any)?.name || '';
      const path = (e as any)?.path || '';
      const meta = path ? await statDesktopPathSafe(String(path)) : null;
      const isFile = !!meta?.isFile || ((e as any)?.children == null && !meta?.isDirectory);
      if (!isFile) continue;
      if (!String(name).toLowerCase().endsWith('.log')) continue;

      try {
        const u = await readDesktopFileBytes(String(path));
        // limita tamanho para não criar ZIP gigante
        const max = 600_000;
        const sliced = u.byteLength > max ? u.slice(u.byteLength - max) : u;
        const text = new TextDecoder().decode(sliced);
        out.push({ name: String(name), text });
      } catch {
        // ignore
      }
    }

    return out.slice(0, 5);
  } catch (e) {
    logger.warn('[SupportPack] Falha ao coletar logs do Desktop:', e);
    return [];
  }
}

export async function downloadSupportPack(): Promise<void> {
  const zip = new JSZip();

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const deviceId = await getDeviceId();

  const license = await getLicenseStatusAsync().catch(() => null);
  const errors = isDesktopApp() ? await getDesktopErrors().catch(() => []) : [];
  const crashLog = await exportCrashLog().catch(() => '[]');
  const crashCount = await getCrashLogCount().catch(() => 0);
  const logs = isDesktopApp() ? await collectDesktopLogs() : [];
  const perf = (() => {
    try {
      return getPerfSnapshot();
    } catch {
      return null;
    }
  })();

  const selfTest = (() => {
    try {
      return getLastSelfTest();
    } catch {
      return null;
    }
  })();

  const diag = (() => {
    try {
      return getDiagLogs();
    } catch {
      return null;
    }
  })();

  const persistenceInfo = await getPersistenceInfo().catch(() => null);

  const meta = {
    app: 'Smart Tech PDV',
    platform: isDesktopApp() ? 'desktop-tauri' : 'web',
    build: {
      version: BUILD_VERSION,
      id: BUILD_ID,
      date: BUILD_DATE,
      commit: BUILD_COMMIT,
    },
    deviceId,
    license,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    createdAt: now.toISOString(),
    crashLogCount: crashCount,
  };

  zip.file('meta.json', JSON.stringify(meta, null, 2));
  zip.file('errors.json', JSON.stringify(errors, null, 2));
  // ✅ Incluir crash log do P1-07 (captura local de erros JavaScript)
  zip.file('crash-log.json', crashLog);

  // ✅ Métricas de performance (PC fraco) — marks/measures/long tasks
  if (perf) {
    zip.file('perf.json', JSON.stringify(perf, null, 2));
  }

  // ✅ Auto-teste (Passo 10) — último resultado
  if (selfTest) {
    zip.file('self-test.json', JSON.stringify(selfTest, null, 2));
  }

  // ✅ Logs leves de diagnóstico (warn/error + opcionalmente info/debug quando ligado)
  if (diag && Array.isArray(diag) && diag.length) {
    zip.file('diag-log.json', JSON.stringify(diag, null, 2));
  }

  if (persistenceInfo) {
    zip.file('persistence-info.json', JSON.stringify(persistenceInfo, null, 2));

    const currentCounts = persistenceInfo.currentStoreDb?.tableCounts || {};
    const globalCounts = persistenceInfo.globalDb?.tableCounts || {};
    const summary = [
      '# SUPPORT SUMMARY',
      '',
      `- store ativo: ${persistenceInfo.activeStoreId || '(sem store)'}`,
      `- db status: ${persistenceInfo.dbStatus || 'unknown'}`,
      `- db atual: ${persistenceInfo.currentStoreDb?.resolvedPath || '(indisponível)'}`,
      `- db global: ${persistenceInfo.globalDb?.resolvedPath || '(indisponível)'}`,
      '',
      '## currentStoreDb tableCounts',
      ...Object.entries(currentCounts).map(([k, v]) => `- ${k}: ${v}`),
      '',
      '## globalDb tableCounts',
      ...Object.entries(globalCounts).map(([k, v]) => `- ${k}: ${v}`),
    ].join('\n');

    zip.file('SUPPORT-SUMMARY.md', summary);
  }

  // ✅ Roteiro de teste para o suporte (markdown)
  zip.file('TESTE-PDV_OFFLINE.md', TESTE_EXTREMO_MD);

  if (logs && logs.length) {
    for (const l of logs) {
      zip.file(`logs/${l.name}`, l.text);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const filename = `suporte-smart-tech-${deviceId || 'device'}-${date}.zip`;

  if (isDesktopApp()) {
    const ok = await saveBlobDesktop(blob, filename);
    if (!ok) return; // cancelado
    return;
  }

  downloadBlobInBrowser(blob, filename);
}
