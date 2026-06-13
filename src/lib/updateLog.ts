export type UpdateLogType =
  | 'check'
  | 'need_refresh'
  | 'apply'
  | 'dismiss'
  | 'clear_cache'
  | 'mark_read'
  | 'error';

export type UpdateLogEntry = {
  ts: string; // ISO
  type: UpdateLogType;
  message: string;
};

const KEY = 'smart-tech:update-log';
const MAX = 50;

export function getUpdateLogs(): UpdateLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean).slice(-MAX) as UpdateLogEntry[];
  } catch {
    return [];
  }
}

export function appendUpdateLog(type: UpdateLogType, message: string) {
  try {
    const list = getUpdateLogs();
    list.push({ ts: new Date().toISOString(), type, message });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // ignore
  }
}

export function clearUpdateLogs() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
