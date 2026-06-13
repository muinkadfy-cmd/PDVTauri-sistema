import { useEffect, useMemo, useState } from 'react';
import { getLicenseStatus, getLicenseStatusAsync } from '@/lib/license';
import { loadBackupFromFile, restoreBackup, validateBackup, verifyBackupIntegrity } from '@/lib/backup';
import {
  getAutoBackupRuntimeState,
  getAutoBackupSchedule,
  onAutoBackupRuntimeChange,
  recordManualBackup,
  setAutoBackupSchedule,
  type AutoBackupRuntimeState,
  type AutoBackupSchedule,
} from '@/lib/auto-backup';
import { saveBackupZip, loadBackupZipFromFile, restoreUsadosFilesFromZip, type ZipRestoreContext } from '@/lib/backup-zip';
import { getClientId } from '@/lib/tenant';
import { showToast } from '@/components/ui/ToastContainer';
import Modal from '@/components/ui/Modal';
import {
  clearPinnedBackupDirectory,
  getPinnedBackupDirectory,
  isDirectoryPickerSupported,
  pickAndPinBackupDirectory,
} from '@/lib/backup-folder';
import PageHeader from '@/components/ui/PageHeader';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { getCurrentSession } from '@/lib/auth-supabase';
import { getCommercialPersistenceDiagnostics, type CommercialPersistenceDiagnostics } from '@/lib/persistence-diagnostics-p5';
import './BackupPage.css';

function formatDateTime(value?: number | string | null): string {
  if (!value) return '—';
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getBackupRuntimeLabel(runtime: AutoBackupRuntimeState): { tone: 'ok' | 'warn' | 'danger' | 'info'; text: string } {
  if (runtime.running) {
    return {
      tone: 'info',
      text: runtime.runningReason === 'close' ? 'Executando backup no fechamento' : 'Executando backup automático',
    };
  }
  if (runtime.lastRunOk === false) {
    return { tone: 'danger', text: runtime.lastRunError || 'Falha no último backup automático' };
  }
  if (!runtime.lastBackupMs) {
    return { tone: 'warn', text: 'Nenhum backup manual encontrado ainda' };
  }
  return { tone: 'ok', text: 'Backup recente disponível' };
}

function BackupPage() {
  const [mostrarModalRestore, setMostrarModalRestore] = useState(false);
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pinnedDirName, setPinnedDirName] = useState<string>('');
  const [pinnedWritable, setPinnedWritable] = useState<boolean>(false);
  const [integrityStatus, setIntegrityStatus] = useState<{ ok: boolean; warning?: string } | null>(null);
  const [restoreFileSize, setRestoreFileSize] = useState<number>(0);
  const [zipCtx, setZipCtx] = useState<ZipRestoreContext | null>(null);
  const [autoSchedule, setAutoScheduleState] = useState<AutoBackupSchedule>({ enabled: false, time: '18:00' });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [license, setLicense] = useState(() => getLicenseStatus());
  const [runtimeState, setRuntimeState] = useState<AutoBackupRuntimeState>(() => getAutoBackupRuntimeState());
  const [persistenceDiag, setPersistenceDiag] = useState<CommercialPersistenceDiagnostics | null>(null);
  const [diagExpanded, setDiagExpanded] = useState(false);
  const isTrial = license.status === 'trial';

  useEffect(() => {
    getLicenseStatusAsync().then(setLicense).catch(() => undefined);
    getCommercialPersistenceDiagnostics().then(setPersistenceDiag).catch(() => undefined);
  }, []);

  useEffect(() => {
    void getAutoBackupSchedule().then(setAutoScheduleState).catch(() => undefined);
  }, []);

  useEffect(() => onAutoBackupRuntimeChange(setRuntimeState), []);

  const clientId = getClientId();
  const activeStoreId = getRuntimeStoreId();
  const session = getCurrentSession();
  const isSuperAdmin = Boolean(session?.isSuperAdmin);
  const fsSupported = useMemo(() => isDirectoryPickerSupported(), []);

  const refreshPinned = async () => {
    const res = await getPinnedBackupDirectory();
    setPinnedDirName(res.name || '');
    setPinnedWritable(res.writable);
  };

  useEffect(() => {
    void refreshPinned();
  }, []);

  useEffect(() => {
    let retryTimer: number | undefined;

    const refreshRuntime = () => {
      void getLicenseStatusAsync().then(setLicense).catch(() => undefined);
      void getAutoBackupSchedule().then(setAutoScheduleState).catch(() => undefined);
      void getCommercialPersistenceDiagnostics().then(setPersistenceDiag).catch(() => undefined);
      setRuntimeState(getAutoBackupRuntimeState());
      void refreshPinned();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshRuntime();
    };

    window.addEventListener('smarttech:sqlite-ready', refreshRuntime as EventListener);
    window.addEventListener('smarttech:store-changed', refreshRuntime as EventListener);
    document.addEventListener('visibilitychange', onVisibility);

    retryTimer = window.setTimeout(refreshRuntime, 280);

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('smarttech:sqlite-ready', refreshRuntime as EventListener);
      window.removeEventListener('smarttech:store-changed', refreshRuntime as EventListener);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const resetRestoreState = () => {
    setMostrarModalRestore(false);
    setBackupPreview(null);
    setZipCtx(null);
    setIntegrityStatus(null);
    setRestoreFileSize(0);
  };

  const fazerBackupZip = async () => {
    if (isTrial) {
      showToast('DEMO: Backup bloqueado. Ative a licença para liberar.', 'warning');
      return;
    }
    if (!clientId) {
      showToast('CLIENT_ID não configurado', 'error');
      return;
    }

    setLoading(true);
    const res = await saveBackupZip(true);
    setLoading(false);

    if (!res.success) {
      showToast(res.error || 'Erro ao exportar backup ZIP', 'error');
      return;
    }

    const extra = res.filesCount ? ` (${res.filesCount} anexos)` : '';
    showToast(
      res.method === 'folder'
        ? `Backup completo salvo na pasta fixada${extra}!`
        : `Backup completo ZIP exportado${extra}!`,
      'success'
    );

    await recordManualBackup();
    setRuntimeState(getAutoBackupRuntimeState());
  };

  const escolherPasta = async () => {
    const res = await pickAndPinBackupDirectory();
    if (!res.success) {
      showToast(res.error || 'Não foi possível fixar a pasta', 'warning');
      return;
    }
    await refreshPinned();
    showToast(`Pasta fixada para backups: ${res.name || 'Selecionada'}`, 'success');
  };

  const removerPastaFixada = async () => {
    const ok = await clearPinnedBackupDirectory();
    await refreshPinned();
    showToast(ok ? 'Pasta fixada removida.' : 'Não foi possível remover a pasta fixada.', ok ? 'success' : 'warning');
  };

  const handleRestoreClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.json.gz,.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setLoading(true);

      const name = (file.name || '').toLowerCase();
      let backup: any = null;
      let nextZipCtx: ZipRestoreContext | null = null;

      if (name.endsWith('.zip')) {
        const loaded = await loadBackupZipFromFile(file);
        if (loaded) {
          backup = loaded.backup;
          nextZipCtx = loaded.ctx;
        }
      } else {
        backup = await loadBackupFromFile(file);
      }

      setLoading(false);

      if (!backup) {
        showToast('Erro ao carregar arquivo de backup', 'error');
        return;
      }

      setRestoreFileSize(file.size || 0);
      if (nextZipCtx?.warnings?.length) {
        showToast(nextZipCtx.warnings[0], 'warning', 7000);
      }

      const integrity = await verifyBackupIntegrity(backup);
      setIntegrityStatus(integrity);
      if (!integrity.ok) {
        showToast(integrity.warning || 'Falha na integridade do backup', 'error', 8000);
        if (!confirm('ATENÇÃO: O backup pode estar corrompido/modificado. Deseja continuar mesmo assim?')) {
          setIntegrityStatus(null);
          setRestoreFileSize(0);
          setZipCtx(null);
          return;
        }
      } else if (integrity.warning) {
        showToast(integrity.warning, 'warning', 7000);
      }

      const validation = validateBackup(backup);
      if (!validation.valid) {
        showToast(`Backup inválido: ${validation.error}`, 'error');
        setZipCtx(null);
        return;
      }

      if (backup.clientId !== clientId) {
        if (!isSuperAdmin) {
          showToast('Este backup pertence a outro CLIENT_ID. Somente a conta principal pode continuar.', 'error', 8000);
          setZipCtx(null);
          return;
        }
        showToast(`CLIENT_ID do backup (${backup.clientId}) nao corresponde ao atual (${clientId}). Como SuperAdmin, revise com cuidado.`, 'warning', 8000);
      }

      if (backup.storeId && activeStoreId && backup.storeId !== activeStoreId && !isSuperAdmin) {
        showToast('Por seguranca, apenas a conta principal pode restaurar backup de outra loja.', 'error', 8000);
        setZipCtx(null);
        return;
      }

      setZipCtx(nextZipCtx);
      setBackupPreview(backup);
      setMostrarModalRestore(true);
    };
    input.click();
  };

  const confirmarRestore = async () => {
    if (isTrial) {
      showToast('DEMO: Restauração bloqueada. Ative a licença para liberar.', 'warning');
      return;
    }
    if (!backupPreview) return;

    setLoading(true);
    const result = await restoreBackup(backupPreview, true);
    let attachmentWarnings: string[] = [];

    if (result.success && zipCtx) {
      try {
        const files = await restoreUsadosFilesFromZip(zipCtx);
        attachmentWarnings = files.warnings || [];
        const restoredTarget = files.totalExpected || files.totalManifest;
        if (restoredTarget > 0) {
          showToast(
            `Anexos do ZIP restaurados: ${files.restored}/${restoredTarget}. Os arquivos locais foram restaurados para uso offline e entram no backup local.`,
            files.restored === restoredTarget && attachmentWarnings.length === 0 ? 'success' : 'warning',
            7000,
          );
        }
      } catch {
        attachmentWarnings = ['Dados restaurados, mas falha ao restaurar anexos do ZIP neste dispositivo.'];
        showToast('Dados restaurados, mas os anexos do ZIP nao puderam ser recuperados neste dispositivo.', 'warning', 7000);
      }
    }

    setLoading(false);

    if (result.success) {
      const combinedWarnings = [...(result.warnings || []), ...attachmentWarnings];
      if (combinedWarnings.length) {
        showToast(`Backup restaurado com alertas: ${combinedWarnings[0]}`, 'warning', 8500);
      } else {
        showToast('Backup restaurado com sucesso! Se houver anexos locais, confira a galeria e faça um novo backup local em seguida.', 'success', 7000);
      }
      resetRestoreState();
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    showToast(`Erro ao restaurar: ${result.error}`, 'error');
  };

  const salvarAgendamento = async () => {
    setSavingSchedule(true);
    try {
      await setAutoBackupSchedule(autoSchedule);
      showToast(
        autoSchedule.enabled
          ? `Backup automático diário ativado (${autoSchedule.time}).`
          : 'Backup automático diário desativado.',
        'success',
      );
      setRuntimeState(getAutoBackupRuntimeState());
    } catch {
      showToast('Não foi possível salvar o agendamento.', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const runtimeLabel = useMemo(() => getBackupRuntimeLabel(runtimeState), [runtimeState]);

  const previewStats = useMemo(() => {
    if (!backupPreview?.data) return [] as Array<{ label: string; value: number }>;
    const data = backupPreview.data;
    return [
      { label: 'Clientes', value: data.clientes?.length || 0 },
      { label: 'Produtos', value: data.produtos?.length || 0 },
      { label: 'Vendas', value: data.vendas?.length || 0 },
      { label: 'Ordens', value: data.ordens?.length || 0 },
      { label: 'Financeiro', value: data.financeiro?.length || 0 },
      { label: 'Cobranças', value: data.cobrancas?.length || 0 },
      { label: 'Devoluções', value: data.devolucoes?.length || 0 },
      { label: 'Encomendas', value: data.encomendas?.length || 0 },
      { label: 'Recibos', value: data.recibos?.length || 0 },
      { label: 'Pessoas', value: data.pessoas?.length || 0 },
      { label: 'Usados', value: data.usados?.length || 0 },
      { label: 'Vendas usados', value: data.usadosVendas?.length || 0 },
      { label: 'Configurações', value: data.settings?.length || 0 },
      { label: 'Fornecedores', value: data.fornecedores?.length || 0 },
      { label: 'Taxas de pagamento', value: data.taxasPagamento?.length || 0 },
      { label: 'Arquivos (refs)', value: data.usadosArquivos?.length || 0 },
      { label: 'Anexos offline', value: data.usadosFiles?.length || 0 },
      { label: 'Anexos no ZIP', value: zipCtx?.manifest?.length || 0 },
    ].filter((item) => item.value > 0);
  }, [backupPreview, zipCtx]);

  const summaryCards = useMemo(() => [
    {
      label: 'Último backup',
      value: formatDateTime(runtimeState.lastBackupMs),
      hint: runtimeState.lastRunReason === 'manual' ? 'Manual concluído com sucesso' : 'Pronto para restore seguro',
    },
    {
      label: 'Próximo auto-backup',
      value: runtimeState.nextScheduledRunAtMs ? formatDateTime(runtimeState.nextScheduledRunAtMs) : 'Desativado',
      hint: autoSchedule.enabled ? `Agendado diariamente às ${autoSchedule.time}` : 'Ative o agendamento diário',
    },
    {
      label: 'Pasta fixada',
      value: pinnedDirName || 'Não configurada',
      hint: pinnedDirName ? (pinnedWritable ? 'Pronta para uso automático' : 'Sem permissão de escrita') : 'Recomendado para fechar o fluxo premium',
    },
    {
      label: 'STORE_ID atual',
      value: activeStoreId || '—',
      hint: 'Confirma a restauração na loja correta',
    },
  ], [activeStoreId, autoSchedule.enabled, autoSchedule.time, pinnedDirName, pinnedWritable, runtimeState.lastBackupMs, runtimeState.nextScheduledRunAtMs]);

  const diagTone = persistenceDiag?.databaseStatus === 'critical'
    ? 'critical'
    : persistenceDiag?.databaseStatus === 'warning'
      ? 'warning'
      : persistenceDiag?.databaseStatus === 'ok'
        ? 'ok'
        : 'unknown';

  const primaryDiagModules = useMemo(() => {
    if (!persistenceDiag) return [] as CommercialPersistenceDiagnostics['modules'];
    const important = new Set(['clientes', 'produtos', 'vendas', 'ordens', 'financeiro', 'usados', 'usadosVendas', 'cobrancas']);
    const primary = persistenceDiag.modules.filter((m) => important.has(m.key));
    return primary.length ? primary : persistenceDiag.modules.slice(0, 8);
  }, [persistenceDiag]);

  const recarregarDiagnostico = async () => {
    try {
      const next = await getCommercialPersistenceDiagnostics();
      setPersistenceDiag(next);
      showToast('Diagnóstico de persistência atualizado.', 'success');
    } catch {
      showToast('Não foi possível atualizar o diagnóstico agora.', 'error');
    }
  };

  const copiarDiagnostico = async () => {
    if (!persistenceDiag) return;
    const lines = [
      'Smart Tech PDV — diagnóstico de persistência',
      `Modo: ${persistenceDiag.runtime === 'desktop' ? 'Desktop offline' : 'Web'}`,
      `Banco: ${persistenceDiag.databaseStatus.toUpperCase()}`,
      `Registros: ${persistenceDiag.totalRecords}`,
      `STORE_ID: ${persistenceDiag.storeId || '—'}`,
      `CLIENT_ID: ${persistenceDiag.clientId || clientId || '—'}`,
      `Device ID: ${persistenceDiag.deviceId || '—'}`,
      `Banco atual: ${persistenceDiag.databasePath || '—'}`,
      `Avisos: ${persistenceDiag.warnings.length ? persistenceDiag.warnings.join(' | ') : 'sem avisos'}`,
      '',
      'Módulos:',
      ...persistenceDiag.modules.map((m) => `${m.label}: ${m.count} (${m.status})`),
      '',
      'Fotos e anexos:',
      ...persistenceDiag.media.map((m) => `${m.label}: ${m.saved}/${m.total} (${m.status}) - ${m.detail}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Diagnóstico copiado para a área de transferência.', 'success');
    } catch {
      showToast('Não foi possível copiar automaticamente. Abra os detalhes e copie manualmente.', 'warning');
    }
  };

  const restoreWarningStoreMismatch = !!(
    backupPreview?.storeId &&
    activeStoreId &&
    backupPreview.storeId !== activeStoreId
  );

  const restoreBlockedByScope = Boolean(
    backupPreview?.storeId &&
    activeStoreId &&
    backupPreview.storeId !== activeStoreId &&
    !isSuperAdmin
  );

  return (
    <div className="backup-page page-container">
      <PageHeader
        kicker="Sistema e segurança"
        title="Backup e restauração"
        subtitle="Feche o ciclo premium de segurança: backup recente, pasta fixada e restauração validada antes de qualquer manutenção."
        right={<div className={`backup-runtime-pill tone-${runtimeLabel.tone}`}>{runtimeLabel.text}</div>}
      />

      <section className="backup-summary-grid">
        {summaryCards.map((item) => (
          <div key={item.label} className="backup-summary-card">
            <span className="backup-summary-label">{item.label}</span>
            <strong className="backup-summary-value">{item.value}</strong>
            <span className="backup-summary-hint">{item.hint}</span>
          </div>
        ))}
      </section>

      {persistenceDiag && (
        <section className={`backup-diagnostic-card backup-diagnostic-card--${diagTone}`}>
          <div className="backup-diagnostic-main">
            <div className="backup-diagnostic-head">
              <span className="backup-diagnostic-kicker">Diagnóstico do banco</span>
              <h3>
                {diagTone === 'critical'
                  ? 'Atenção: banco em estado crítico'
                  : diagTone === 'warning'
                    ? 'Banco precisa de conferência'
                    : 'Persistência local conferida'}
              </h3>
              <p>
                Confira se o sistema está usando o banco correto antes de fazer backup, restaurar ou atualizar.
              </p>
            </div>

            <div className="backup-diagnostic-status">
              <div>
                <span>Banco</span>
                <strong>{persistenceDiag.databaseStatus.toUpperCase()}</strong>
              </div>
              <div>
                <span>Registros</span>
                <strong>{persistenceDiag.totalRecords}</strong>
              </div>
              <div>
                <span>Store</span>
                <strong title={persistenceDiag.storeId || '—'}>
                  {persistenceDiag.storeId ? `${persistenceDiag.storeId.slice(0, 8)}...` : '—'}
                </strong>
              </div>
            </div>

            {persistenceDiag.warnings.length > 0 && (
              <div className="backup-diagnostic-warning">
                {persistenceDiag.warnings[0]}
              </div>
            )}

            <div className="backup-diagnostic-actions">
              <button type="button" className="btn-secondary" onClick={copiarDiagnostico}>
                Copiar diagnóstico
              </button>
              <button type="button" className="btn-secondary" onClick={recarregarDiagnostico}>
                Recarregar
              </button>
              <button type="button" className="btn-secondary" onClick={() => setDiagExpanded((v) => !v)}>
                {diagExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              </button>
            </div>
          </div>

          <div className="backup-diagnostic-mini-grid">
            {primaryDiagModules.map((m) => (
              <div key={m.key} className={`backup-diagnostic-mini backup-diagnostic-mini--${m.status.toLowerCase()}`}>
                <span>{m.label}</span>
                <strong>{m.count}</strong>
              </div>
            ))}
          </div>

          {diagExpanded && (
            <div className="backup-diagnostic-details">
              {persistenceDiag.databasePath && (
                <div className="backup-diagnostic-path">
                  <span>Banco atual</span>
                  <strong>{persistenceDiag.databasePath}</strong>
                </div>
              )}
              <div className="backup-diagnostic-ids">
                <div><span>Modo</span><strong>{persistenceDiag.runtime === 'desktop' ? 'Desktop offline' : 'Web'}</strong></div>
                <div><span>CLIENT_ID</span><strong>{persistenceDiag.clientId || clientId || '—'}</strong></div>
                <div><span>Device ID</span><strong>{persistenceDiag.deviceId || '—'}</strong></div>
              </div>
              {persistenceDiag.warnings.length > 1 && (
                <div className="backup-warning-box backup-warning-box--soft">
                  {persistenceDiag.warnings.join(' • ')}
                </div>
              )}
              <div className="backup-diagnostic-media">
                <span className="backup-diagnostic-kicker">Fotos e anexos no backup</span>
                <div className="backup-diagnostic-media-grid">
                  {persistenceDiag.media.map((m) => (
                    <div key={m.key} className={`backup-diagnostic-media-item backup-diagnostic-media-item--${m.status.toLowerCase()}`}>
                      <div>
                        <strong>{m.label}</strong>
                        <span>{m.detail}</span>
                      </div>
                      <b>{m.saved}/{m.total}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="backup-preview-stats backup-preview-stats--compact">
                {persistenceDiag.modules.map((m) => (
                  <div key={m.key} className="backup-preview-stat">
                    <span>{m.label}</span>
                    <strong>{m.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="backup-cards">
        <div className="backup-card backup-card--primary">
          <div className="backup-icon">💾</div>
          <h3>Backup Completo</h3>
          <p>Fluxo manual único recomendado: gera ZIP completo com integridade, dados da loja e anexos offline para restore rápido.</p>

          {fsSupported && (
            <div className="backup-control-block backup-control-block--soft">
              <div className="backup-directory-head">
                <strong>Pasta fixada</strong>
                <span className={`backup-directory-badge ${pinnedDirName ? (pinnedWritable ? 'ok' : 'warn') : 'neutral'}`}>
                  {pinnedDirName ? (pinnedWritable ? 'Pronta' : 'Sem permissão') : 'Não configurada'}
                </span>
              </div>
              <div className="backup-directory-name">{pinnedDirName || 'Escolha uma pasta para automatizar os próximos backups.'}</div>
              <div className="backup-inline-actions">
                <button className="btn-secondary" onClick={escolherPasta} disabled={loading}>Escolher pasta</button>
                <button className="btn-secondary" onClick={removerPastaFixada} disabled={loading || !pinnedDirName}>Remover pasta</button>
              </div>
            </div>
          )}

          <div className="backup-action-stack">
            <button className="btn-primary" onClick={fazerBackupZip} disabled={loading}>
              {loading ? 'Exportando...' : 'Fazer Backup Completo'}
            </button>
          </div>

          <div className="backup-control-block backup-schedule-panel">
            <div className="backup-schedule-title">Backup automático por horário</div>
            <div className="backup-schedule-grid">
              <label className="backup-check-row">
                <input
                  type="checkbox"
                  checked={autoSchedule.enabled}
                  onChange={(e) => setAutoScheduleState((p) => ({ ...p, enabled: e.target.checked }))}
                  disabled={savingSchedule}
                />
                <span>Ativar diário</span>
              </label>
              <label className="backup-time-row">
                <span>Horário</span>
                <input
                  type="time"
                  value={autoSchedule.time}
                  onChange={(e) => setAutoScheduleState((p) => ({ ...p, time: e.target.value }))}
                  disabled={!autoSchedule.enabled || savingSchedule}
                  className="backup-time-input"
                />
              </label>
            </div>
            <button className="btn-secondary" onClick={salvarAgendamento} disabled={savingSchedule}>
              {savingSchedule ? 'Salvando...' : 'Salvar agendamento'}
            </button>
            <div className="backup-caption">Dica: pasta fixada + horário diário = menor risco no reopen e em atualizações.</div>
          </div>
        </div>

        <div className="backup-card">
          <div className="backup-icon">📥</div>
          <h3>Restaurar Backup</h3>
          <p>Importe um arquivo validado, confira CLIENT_ID e STORE_ID e restaure com previsibilidade.</p>

          <div className="backup-restore-status-grid">
            <div>
              <span className="backup-summary-label">CLIENT_ID atual</span>
              <strong className="backup-summary-value">{clientId || '—'}</strong>
            </div>
            <div>
              <span className="backup-summary-label">STORE_ID atual</span>
              <strong className="backup-summary-value">{activeStoreId || '—'}</strong>
            </div>
          </div>

          <button className="btn-secondary" onClick={handleRestoreClick} disabled={loading}>
            {loading ? 'Carregando...' : 'Restaurar Backup'}
          </button>
        </div>

        <div className="backup-card media">
          <div className="backup-icon">🔒</div>
          <h3>Segurança do Sistema</h3>
          <p>Seus dados ficam mais seguros quando você mantém um backup recente e guarda a licença em local seguro.</p>
          <div className="backup-media">
            <img src="/backup-safe.svg" alt="Ilustração de segurança e backup" loading="lazy" />
          </div>
          <div className="backup-media-caption">
            Fechamento protegido + backup recente + restore validado = experiência premium com menos sustos no cliente final.
          </div>
        </div>
      </div>

      <div className="backup-info">
        <h3>Informações</h3>
        <ul>
          <li>O backup inclui <strong>TODOS os dados operacionais</strong>: clientes, produtos, vendas, ordens, financeiro, cobranças, devoluções, encomendas, recibos, pessoas, usados, fornecedores, aparelhos vendidos, taxas, configurações e anexos.</li>
          <li>O fluxo manual principal agora gera <strong>ZIP completo com verificação de integridade</strong>. A restauração continua compatível com backups legados em JSON/JSON.GZ.</li>
          {fsSupported && <li>Fixar uma pasta deixa o fluxo mais confiável para rotina diária e para o fechamento protegido.</li>}
          <li>A restauração substitui todos os dados atuais do cliente.</li>
          <li><strong>Total de tabelas no backup:</strong> 18 coleções completas + estado global seguro + anexos offline.</li>
          {clientId && <li><strong>CLIENT_ID atual:</strong> {clientId}</li>}
        </ul>
      </div>

      <Modal isOpen={mostrarModalRestore} onClose={resetRestoreState} title="Confirmar Restauração de Backup" size="md">
        {backupPreview && (
          <div>
            <p className="backup-modal-lead">
              Você está prestes a restaurar um backup. Todos os dados atuais serão substituídos após a confirmação.
            </p>
            <div className="backup-restore-preview">
              <div className="backup-preview-meta-grid">
                <div><strong>CLIENT_ID:</strong> {backupPreview.clientId}</div>
                <div><strong>STORE_ID do backup:</strong> {backupPreview.storeId || backupPreview?.integrity?.storeId || '—'}</div>
                <div><strong>STORE_ID atual:</strong> {activeStoreId || '—'}</div>
                <div><strong>Exportado em:</strong> {formatDateTime(backupPreview.exportedAt)}</div>
                <div><strong>Versão:</strong> {backupPreview.version}</div>
                <div><strong>Tamanho do arquivo:</strong> {formatBytes(restoreFileSize)}</div>
                <div><strong>Integridade:</strong> {integrityStatus ? (integrityStatus.ok ? 'OK' : 'FALHA') : '—'}</div>
                {zipCtx && <div><strong>Anexos no ZIP:</strong> {zipCtx.manifest.length}</div>}
              </div>

              {restoreWarningStoreMismatch && (
                <div className="backup-warning-box">
                  {restoreBlockedByScope
                    ? '⚠️ Este backup pertence a outra loja. Por seguranca, somente a conta principal pode restaurar dados cross-store.'
                    : '⚠️ Este backup parece ser de outra loja. Como conta principal, revise com cuidado antes de continuar.'}
                </div>
              )}
              {integrityStatus?.warning && (
                <div className="backup-warning-box backup-warning-box--soft">⚠️ {integrityStatus.warning}</div>
              )}

              <div className="backup-preview-stats">
                {previewStats.map((item) => (
                  <div key={item.label} className="backup-preview-stat">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="backup-modal-actions">
              <button className="btn-secondary" onClick={resetRestoreState} disabled={loading}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarRestore} disabled={loading || restoreBlockedByScope}>
                {restoreBlockedByScope ? 'Restauracao bloqueada' : loading ? 'Restaurando...' : 'Confirmar Restauração'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default BackupPage;
