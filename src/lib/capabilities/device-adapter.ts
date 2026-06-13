import { isDesktopApp } from '@/lib/platform';

export async function getCanonicalDeviceIdByPlatform(): Promise<string | null> {
  if (!isDesktopApp()) return null;

  const { invoke } = await import('@tauri-apps/api/core');
  const canonical = await invoke<string>('get_or_create_device_id');
  const id = String(canonical || '').trim();
  return id || null;
}
