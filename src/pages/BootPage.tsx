import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentSession } from '@/lib/auth-supabase';
import { getStoreId } from '@/lib/store-id';
import { withTimeout } from '@/lib/async';
import { TimeoutScreen } from '@/components/TimeoutScreen';
import { migrateStorage } from '@/lib/storage';
import { applyLayoutModes } from '@/lib/layout-modes';
import { initCompanyLock } from '@/lib/company-lock';
import { initAutoBackup } from '@/lib/auto-backup';
import { initCrashReport } from '@/lib/crash-report';
import { hydrateDesktopGlobals } from '@/lib/desktop-globals';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';

/**
 * Splash/Boot route
 * - Evita montar o Layout (e o boot pesado) antes de decidir login vs app
 * - Centraliza decisão de navegação inicial
 */
export default function BootPage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('Preparando…');
  const [err, setErr] = useState<Error | null>(null);

  const session = useMemo(() => {
    try {
      return getCurrentSession();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try { perfMarkOnce('boot_start'); } catch {}
      setErr(null);
      try {
        setMsg('Verificando configuração…');

        // ✅ P0: no Desktop, hidrata globals ANTES de resolver storeId (evita perder store_id após update/limpeza)
        try { await hydrateDesktopGlobals(); } catch (e) { console.warn('[Boot] hydrateDesktopGlobals falhou:', e); }

        // Garante storeId resolvido/gerado (local-only) cedo
        const { storeId, source } = await withTimeout(Promise.resolve(getStoreId()), 3000, 'Timeout ao resolver storeId');

        if (!session) {
          navigate('/painel', { replace: true });
          return;
        }

        // Sessão existe mas storeId pode estar ausente em alguns cenários
        if (!storeId || source === 'missing' || source === 'invalid') {
          navigate('/setup', { replace: true });
          return;
        }

        // ✅ Init PRIVADO (roda só quando existe sessão + storeId válido)
        // Objetivo: tirar boot pesado do Layout e evitar travar rotas públicas.
        setMsg('Inicializando dados locais…');

        // 1) Migração multi-store (best-effort)
        try {
          const mod = await import('@/lib/store-migration');
          mod?.migrateStoreData?.();
        } catch (e) {
          // não bloquear boot
          console.warn('[Boot] store-migration falhou:', e);
        }

        // 2) Migrar storage antigo (local)
        try {
          migrateStorage();
        } catch (e) {
          console.warn('[Boot] migrateStorage falhou:', e);
        }

        // 3) Layout modes (compacto/ajustes)
        try {
          applyLayoutModes();
        } catch (e) {
          console.warn('[Boot] applyLayoutModes falhou:', e);
        }

        // 4) Init de segurança/rotinas offline
        try { await initCompanyLock(); } catch (e) { console.warn('[Boot] initCompanyLock falhou:', e); }
        try { await initAutoBackup(); } catch (e) { console.warn('[Boot] initAutoBackup falhou:', e); }
        try { initCrashReport(); } catch (e) { console.warn('[Boot] initCrashReport falhou:', e); }

        // Pequena proteção contra travas inesperadas
        await withTimeout(Promise.resolve(true), 1500);

        if (!alive) return;
        try {
          perfMarkOnce('boot_done');
          perfMeasure('auth_ready→boot_done', 'auth_ready', 'boot_done');
        } catch {
          // ignore
        }
        navigate('/painel', { replace: true });
      } catch {
        // Fail-safe: ir para o painel, que recompõe a sessão local.
        if (!alive) return;
        setMsg('Reiniciando…');
        navigate('/painel', { replace: true });
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [navigate, session]);

  if (err) {
    return (
      <TimeoutScreen
        title="Falha ao inicializar"
        message={err.message || 'Erro desconhecido'}
        onRetry={() => window.location.reload()}
        details={String((err as any)?.stack || err)}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: 16,
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        width: 44,
        height: 44,
        border: '4px solid var(--border-light)',
        borderTop: '4px solid var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <div style={{ marginTop: 12, fontSize: 14 }}>{msg}</div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
