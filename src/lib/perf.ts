/**
 * Performance / Diagnóstico offline (PC fraco)
 * - Coleta marks/measures
 * - Captura "long tasks" (travadas) quando suportado
 * - Exportável via Support Pack (suporte)
 */

import { logger } from '@/utils/logger';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';

type PerfLongTask = {
  startTime: number;
  duration: number;
  name?: string;
};

export type PerfSnapshot = {
  capturedAt: string;
  userAgent?: string;
  platform: 'desktop' | 'web';
  lowEndMode: boolean;
  marks: Array<{ name: string; startTime: number }>;
  measures: Array<{ name: string; startTime: number; duration: number }>;
  longTasks: PerfLongTask[];
  memory?: any;
};

const MAX_LONGTASKS = 120;
const MAX_MEASURES = 200;
const MAX_MARKS = 200;

const state: {
  inited: boolean;
  longTasks: PerfLongTask[];
  markedOnce: Set<string>;
} = {
  inited: false,
  longTasks: [],
  markedOnce: new Set(),
};

function isDesktop(): boolean {
  return typeof (window as any).__TAURI__ !== 'undefined';
}

function isLowEndMode(): boolean {
  try {
    const v = document?.documentElement?.dataset?.lowEnd;
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export function perfInit(): void {
  if (state.inited) return;
  state.inited = true;

  // Em produção, o observer de longtask só fica ativo se diagnóstico estiver ligado.
  // (marks/measures continuam funcionando sem overhead)
  const diagOn = (() => {
    try { return import.meta.env.DEV || getDiagnosticsEnabled(); } catch { return import.meta.env.DEV; }
  })();
  if (!diagOn) return;

  try {
    const PO = (window as any).PerformanceObserver;
    if (!PO) return;

    const obs = new PO((list: any) => {
      const entries = list?.getEntries?.() || [];
      for (const e of entries) {
        const lt: PerfLongTask = {
          startTime: Number(e?.startTime || 0),
          duration: Number(e?.duration || 0),
          name: String(e?.name || ''),
        };
        state.longTasks.push(lt);
        if (state.longTasks.length > MAX_LONGTASKS) {
          state.longTasks.splice(0, state.longTasks.length - MAX_LONGTASKS);
        }
      }
    });

    obs.observe({ entryTypes: ['longtask'] });
  } catch {
    // ignore
  }
}

export function perfMark(name: string): void {
  try {
    performance.mark(name);
  } catch {
    // ignore
  }
}

export function perfMarkOnce(name: string): void {
  if (state.markedOnce.has(name)) return;
  state.markedOnce.add(name);
  perfMark(name);
}

export function perfMeasure(name: string, startMark: string, endMark: string): void {
  try {
    performance.measure(name, startMark, endMark);
  } catch {
    // ignore
  }
}

export function getPerfSnapshot(): PerfSnapshot {
  const now = new Date().toISOString();

  const marks = (() => {
    try {
      const entries = performance.getEntriesByType('mark') as PerformanceEntry[];
      const tail = entries.slice(-MAX_MARKS);
      return tail.map((e) => ({ name: e.name, startTime: e.startTime }));
    } catch {
      return [];
    }
  })();

  const measures = (() => {
    try {
      const entries = performance.getEntriesByType('measure') as PerformanceEntry[];
      const tail = entries.slice(-MAX_MEASURES);
      return tail.map((e) => ({ name: e.name, startTime: e.startTime, duration: e.duration }));
    } catch {
      return [];
    }
  })();

  const memory = (() => {
    try {
      const perfAny: any = performance as any;
      return perfAny?.memory ? { ...perfAny.memory } : undefined;
    } catch {
      return undefined;
    }
  })();

  return {
    capturedAt: now,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    platform: isDesktop() ? 'desktop' : 'web',
    lowEndMode: isLowEndMode(),
    marks,
    measures,
    longTasks: [...state.longTasks],
    memory,
  };
}

export function logPerfSummary(): void {
  try {
    const snap = getPerfSnapshot();
    const important = snap.measures.filter((m) =>
      /app_start→react_rendered|app_start→auth_ready|auth_ready→private_shell/i.test(m.name)
    );
    if (important.length) logger.log('[Perf] Measures importantes:', important);
  } catch {
    // ignore
  }
}
