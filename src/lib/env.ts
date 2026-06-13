import { isDesktopApp } from './platform';

const desktopOffline = isDesktopApp();
const supabaseUrl = desktopOffline ? '' : import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = desktopOffline ? '' : import.meta.env.VITE_SUPABASE_ANON_KEY;

const superAdminEnvEnabled = String(import.meta.env.VITE_SUPERADMIN || '').toLowerCase() === 'true';

export const ENV = {
  clientId: import.meta.env.VITE_CLIENT_ID || 'local',
  supabaseUrl,
  supabaseAnonKey,
  // Desktop/Tauri oficial = offline/local. Supabase fica desligado mesmo se .env.local tiver chaves antigas.
  hasSupabase: !desktopOffline && Boolean(supabaseUrl && supabaseAnonKey),
  // Desktop offline sempre entrega um administrador local inicial simples para primeira entrada.
  superAdminEnabled: desktopOffline || superAdminEnvEnabled,
  superAdminEmail: String(
    import.meta.env.VITE_SUPERADMIN_EMAIL || (desktopOffline ? 'admin' : 'superadmin@smarttech.local')
  ).trim().toLowerCase(),
  superAdminPassword: String(
    import.meta.env.VITE_SUPERADMIN_PASSWORD || (desktopOffline ? '1234' : 'SuperAdmin@123')
  ),
} as const;
