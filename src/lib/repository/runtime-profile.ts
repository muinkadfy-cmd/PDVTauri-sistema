import { isLocalOnly } from '@/lib/mode';
import { isDesktopApp, isWebApp } from '@/lib/platform';

export type RepositoryRuntimeKind = 'desktop' | 'web' | 'pwa' | 'local-only';

export interface RepositoryRuntimeProfile {
  kind: RepositoryRuntimeKind;
  isDesktop: boolean;
  isWeb: boolean;
  isPwa: boolean;
  isLocalOnly: boolean;
  enableSyncDefault: boolean;
  syncImmediatelyDefault: boolean;
}

export type RepositoryOptionsInput = {
  enableSync?: boolean;
  syncImmediately?: boolean;
};

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

export function getRepositoryRuntimeProfile(): RepositoryRuntimeProfile {
  const localOnly = isLocalOnly();
  const desktop = isDesktopApp();
  const web = isWebApp();
  const pwa = web && isStandalonePwa();

  if (localOnly) {
    return {
      kind: 'local-only',
      isDesktop: desktop,
      isWeb: web,
      isPwa: pwa,
      isLocalOnly: true,
      enableSyncDefault: false,
      syncImmediatelyDefault: false
    };
  }

  if (desktop) {
    return {
      kind: 'desktop',
      isDesktop: true,
      isWeb: false,
      isPwa: false,
      isLocalOnly: false,
      enableSyncDefault: false,
      syncImmediatelyDefault: false
    };
  }

  if (pwa) {
    return {
      kind: 'pwa',
      isDesktop: false,
      isWeb: true,
      isPwa: true,
      isLocalOnly: false,
      enableSyncDefault: true,
      syncImmediatelyDefault: true
    };
  }

  return {
    kind: 'web',
    isDesktop: false,
    isWeb: true,
    isPwa: false,
    isLocalOnly: false,
    enableSyncDefault: true,
    syncImmediatelyDefault: true
  };
}

export function resolveRepositoryOptions(
  input: RepositoryOptionsInput = {}
): Required<RepositoryOptionsInput> {
  const profile = getRepositoryRuntimeProfile();
  return {
    enableSync: input.enableSync ?? profile.enableSyncDefault,
    syncImmediately: input.syncImmediately ?? profile.syncImmediatelyDefault
  };
}
