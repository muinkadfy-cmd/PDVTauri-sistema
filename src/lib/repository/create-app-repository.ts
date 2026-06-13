import { DataRepository, type RepositoryOptions } from './data-repository';
import { resolveRepositoryOptions } from './runtime-profile';

export function createAppRepository<T extends { id: string }>(
  tableName: string,
  storageKey: string,
  options: RepositoryOptions = {}
): DataRepository<T> {
  return new DataRepository<T>(
    tableName,
    storageKey,
    resolveRepositoryOptions(options)
  );
}
