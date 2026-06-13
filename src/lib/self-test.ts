import { BUILD_COMMIT, BUILD_DATE, BUILD_ID, BUILD_VERSION } from '@/config/buildInfo';
import { isDesktopApp } from '@/lib/platform';
import { getPerfSnapshot } from '@/lib/perf';

export type SelfTestResult = {
  ok: boolean;
  createdAt: string;
  build: {
    version: string;
    id: string;
    date: string;
    commit: string;
  };
  env: {
    platform: 'desktop-tauri' | 'web';
    userAgent: string;
    lowEnd: boolean;
    perfMode: string | null;
    memory?: {
      jsHeapSizeLimit?: number;
      totalJSHeapSize?: number;
      usedJSHeapSize?: number;
    };
  };
  checks: Array<{ id: string; name: string; ok: boolean; details?: string }>;
  perf?: ReturnType<typeof getPerfSnapshot>;
};

const STORAGE_KEY = 'smarttech:selfTest:last';

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '{"error":"stringify_failed"}';
  }
}

export function getLastSelfTest(): SelfTestResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SelfTestResult;
  } catch {
    return null;
  }
}

export function runSelfTest(): SelfTestResult {
  const root = document?.documentElement;
  const lowEnd = String(root?.dataset?.lowEnd || '') === '1';
  const perfMode = root?.dataset?.perf ?? null;

  const checks: SelfTestResult['checks'] = [];

  // Check 1: Perf marks existence (start/render)
  const marks = (performance.getEntriesByType('mark') || []).map(m => m.name);
  const hasAppStart = marks.includes('app_start');
  const hasReactRendered = marks.includes('react_rendered');
  checks.push({
    id: 'perf-marks',
    name: 'Marcas de performance (app_start / react_rendered)',
    ok: hasAppStart && hasReactRendered,
    details: !hasAppStart || !hasReactRendered
      ? 'Algumas marcas não foram encontradas. Reabra o app e tente novamente.'
      : undefined
  });

  // Check 2: LocalStorage basic read/write
  try {
    const k = 'smarttech:selfTest:tmp';
    localStorage.setItem(k, String(Date.now()));
    const v = localStorage.getItem(k);
    localStorage.removeItem(k);
    checks.push({ id: 'localstorage', name: 'LocalStorage leitura/gravação', ok: Boolean(v) });
  } catch (e: any) {
    checks.push({
      id: 'localstorage',
      name: 'LocalStorage leitura/gravação',
      ok: false,
      details: e?.message || 'Falha ao usar LocalStorage'
    });
  }

  // Check 3: Perf snapshot available
  let perf: ReturnType<typeof getPerfSnapshot> | undefined;
  try {
    perf = getPerfSnapshot();
    checks.push({ id: 'perf-snapshot', name: 'Snapshot de performance disponível', ok: true });
  } catch (e: any) {
    checks.push({
      id: 'perf-snapshot',
      name: 'Snapshot de performance disponível',
      ok: false,
      details: e?.message || 'Falha ao gerar perf snapshot'
    });
  }

  // Check 4: Low-end mode detectability
  checks.push({
    id: 'low-end',
    name: 'Modo PC fraco (low-end) detectável',
    ok: true,
    details: lowEnd ? 'Ativo' : 'Inativo'
  });

  const memory = (performance as any)?.memory
    ? {
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      }
    : undefined;

  const result: SelfTestResult = {
    ok: checks.every(c => c.ok),
    createdAt: new Date().toISOString(),
    build: {
      version: BUILD_VERSION,
      id: BUILD_ID,
      date: BUILD_DATE,
      commit: BUILD_COMMIT,
    },
    env: {
      platform: isDesktopApp() ? 'desktop-tauri' : 'web',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      lowEnd,
      perfMode,
      memory,
    },
    checks,
    perf,
  };

  try {
    localStorage.setItem(STORAGE_KEY, safeJsonStringify(result));
  } catch {
    // ignore
  }

  return result;
}
