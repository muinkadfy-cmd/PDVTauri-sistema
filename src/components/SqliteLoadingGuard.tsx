/**
 * SqliteLoadingGuard — P11: recuperação somente.
 *
 * Antes este componente bloqueava as telas principais com skeleton enquanto
 * aguardava evento do SQLite. No Desktop offline isso gerava tela presa em estado visual falso.
 *
 * Regra nova:
 * - NUNCA mostrar skeleton.
 * - NUNCA bloquear Clientes/Vendas/Produtos/OS/Financeiro.
 * - Renderizar children imediatamente.
 * - Mostrar painel de recuperação apenas quando houver corrupção real marcada
 *   por window.__smarttechDbCorrupted.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { resetSqliteDatabaseForCurrentStore } from '@/lib/db-recovery';
import { showToast } from '@/components/ui/ToastContainer';
import { isDesktopApp } from '@/lib/platform';

interface Props {
  children: React.ReactNode;
  timeout?: number;
}

export function SqliteLoadingGuard({ children }: Props) {
  const navigate = useNavigate();

  const corrupted = isDesktopApp() && ((): boolean => {
    try { return (window as any).__smarttechDbCorrupted === true; } catch { return false; }
  })();

  if (!corrupted) {
    return <>{children}</>;
  }

  let sqliteError = '';
  try { sqliteError = String((window as any).__smarttechSqliteError || ''); } catch {}

  return (
    <DbRecoveryPanel
      error={sqliteError}
      onGoBackup={() => navigate('/backup')}
      onReset={async () => {
        if (!confirm('ATENÇÃO: Resetar o banco APAGA os dados locais desta loja. Use apenas se você vai restaurar um backup.\n\nDeseja continuar?')) return;
        const r = await resetSqliteDatabaseForCurrentStore();
        if (!r.ok) {
          showToast(r.error || 'Falha ao resetar o banco', 'error', 7000);
          return;
        }
        showToast('Banco resetado. Agora restaure um backup.', 'success', 6000);
        navigate('/backup');
      }}
    />
  );
}

function DbRecoveryPanel({
  error,
  onGoBackup,
  onReset,
}: {
  error: string;
  onGoBackup: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{
      padding: '28px 22px',
      maxWidth: 920,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{
        border: '1px solid rgba(239,68,68,0.35)',
        background: 'rgba(239,68,68,0.08)',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          ⚠️ Banco de dados com problema
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary, #334155)' }}>
          O sistema detectou falha real ao abrir o SQLite desta loja. Para evitar perda de dados,
          o app entrou em <b>modo recuperação</b>.
        </div>
        {error ? (
          <div style={{
            marginTop: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: '#7f1d1d',
          }}>
            {error}
          </div>
        ) : null}
      </div>

      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <button
          onClick={onGoBackup}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)',
            background: 'white',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Abrir Backup / Restaurar
        </button>
        <button
          onClick={onReset}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.10)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Resetar banco (emergência)
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
          Dica: se você tiver um backup recente, clique em <b>Abrir Backup / Restaurar</b>.
        </div>
      </div>
    </div>
  );
}
