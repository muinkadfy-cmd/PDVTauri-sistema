import { isDesktopApp } from '@/lib/platform';
import { LocalStore } from '@/lib/repository/local-store';
import { SqliteLocalStore } from '@/lib/repository/sqlite-local-store';

export interface LocalStoreLike<T extends { id: string }> {
  preload(): Promise<number>;
  list(): T[];
  getById(id: string): T | null;
  upsert(item: T): Promise<T | null>;
  upsertMany(items: T[]): Promise<number>;
  remove(id: string): Promise<boolean>;
  removeMany(ids: string[]): Promise<number>;
  clear(): Promise<boolean>;
  count(): number;
}

/**
 * Escolhe a implementação local de dados pela plataforma atual.
 * Mantemos o contrato único para o core do app continuar agnóstico.
 */
export function createPlatformLocalStore<T extends { id: string }>(
  storageKey: string
): LocalStoreLike<T> {
  return isDesktopApp()
    ? new SqliteLocalStore<T>(storageKey)
    : new LocalStore<T>(storageKey);
}
