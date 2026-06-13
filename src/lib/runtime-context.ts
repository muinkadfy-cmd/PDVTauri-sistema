import { getRepositoryRuntimeProfile } from '@/lib/repository/runtime-profile';
import { getCurrentStoreId } from '@/lib/store-id';

export interface AppRuntimeContext {
  kind: 'desktop' | 'web' | 'pwa' | 'local-only';
  isDesktop: boolean;
  isWeb: boolean;
  isPwa: boolean;
  isLocalOnly: boolean;
  bypassStoreScopeFiltering: boolean;
  storeId: string | null;
}

export function getAppRuntimeContext(): AppRuntimeContext {
  const profile = getRepositoryRuntimeProfile();
  const storeId = getCurrentStoreId();

  return {
    kind: profile.kind,
    isDesktop: profile.isDesktop,
    isWeb: profile.isWeb,
    isPwa: profile.isPwa,
    isLocalOnly: profile.isLocalOnly,
    bypassStoreScopeFiltering: profile.isDesktop || profile.isLocalOnly,
    storeId
  };
}

export function shouldBypassStoreScopeFiltering(): boolean {
  return getAppRuntimeContext().bypassStoreScopeFiltering;
}

export function getRuntimeStoreId(): string | null {
  return getAppRuntimeContext().storeId;
}

export function getRuntimeStoreIdOrDefault(fallback = 'default'): string {
  const storeId = getRuntimeStoreId()?.trim();
  return storeId || fallback;
}

export function requireRuntimeStoreId(): string | null {
  return getRuntimeStoreId();
}
