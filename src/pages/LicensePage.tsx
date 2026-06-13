import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceId } from '@/lib/device';
import { isLicenseEnabled, isLicenseMandatory, setFeatureFlag } from '@/lib/mode';
import {
  activateLicense,
  removeLicense,
  getLicenseStatus,
  getLicenseStatusAsync,
  canManageLicense,
  type LicenseStatus,
} from '@/lib/license';
import './LicensePage.css';

function isPermanentLicense(status: LicenseStatus): boolean {
  const plan = String(status.payload?.plan || '').toLowerCase();
  const message = String(status.message || '').toLowerCase();
  const validUntil = status.validUntil ? new Date(status.validUntil) : null;

  if (plan.includes('lifetime') || plan.includes('permanent') || plan.includes('vitalicia') || plan.includes('vitalícia')) {
    return true;
  }
  if (message.includes('permanente') || message.includes('lifetime') || message.includes('vitalicia') || message.includes('vitalícia')) {
    return true;
  }
  return Boolean(validUntil && validUntil.getFullYear() >= 2099);
}

function getCustomerModeLabel(status: LicenseStatus): string {
  if (status.status === 'trial') return 'Trial 15 dias';
  if (status.status === 'active' && isPermanentLicense(status)) return 'Sistema ativado permanente';
  if (status.status === 'active') return 'Sistema ativado';
  if (status.status === 'blocked') return 'Sistema bloqueado';
  if (status.status === 'expired') return 'Trial expirado';
  if (status.status === 'invalid') return 'Ativação inválida';
  return 'Ativação necessária';
}

function getCustomerModeDescription(status: LicenseStatus): string {
  if (status.status === 'trial') {
    const days = typeof status.daysRemaining === 'number' ? `${status.daysRemaining} dia(s) restante(s)` : 'teste em andamento';
    return `Loja liberada por 15 dias para configurar e testar tudo, com ${days}. Depois desse prazo, a ativação será exigida para continuar operando.`;
  }
  if (status.status === 'active' && isPermanentLicense(status)) {
    return 'Loja liberada para uso permanente.';
  }
  if (status.status === 'active') {
    return 'Loja liberada para operação normal.';
  }
  if (status.status === 'blocked') return 'Entre em contato com o suporte para liberar a operação.';
  if (status.status === 'expired') return 'Os 15 dias de teste terminaram. Solicite a ativação da loja para continuar operando.';
  if (status.status === 'invalid') return 'A ativação informada não foi reconhecida.';
  return 'Entre em contato para concluir a liberação da loja.';
}

function getCustomerModeIcon(status: LicenseStatus): string {
  if (status.status === 'trial') return '🧪';
  if (status.status === 'active' && isPermanentLicense(status)) return '🟢';
  if (status.status === 'active') return '✅';
  if (status.status === 'blocked') return '🔒';
  if (status.status === 'expired') return '⌛';
  return '⚠️';
}

function statusIcon(s: LicenseStatus['status']) {
  switch (s) {
    case 'active': return '✅';
    case 'trial': return '🧪';
    case 'expired': return '⏰';
    case 'blocked': return '🔒';
    case 'invalid': return '⚠️';
    case 'not_found': return '🧾';
    case 'offline': return '…';
    default: return '⚠️';
  }
}

function statusColor(s: LicenseStatus['status']) {
  switch (s) {
    case 'active': return 'var(--success, #10b981)';
    case 'trial': return 'var(--success, #10b981)';
    case 'expired':
    case 'blocked': return 'var(--error, #ef4444)';
    case 'invalid':
    case 'not_found':
    case 'offline':
    default: return 'var(--warning, #f59e0b)';
  }
}

export default function LicensePage() {
  const { session } = useAuth();
  const isRealSuperAdmin = session?.isSuperAdmin === true;
  const deviceId = useMemo(() => getDeviceId(), []);
  const mandatory = useMemo(() => isLicenseMandatory(), []);
  const [enabled, setEnabled] = useState(isLicenseEnabled());
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(getLicenseStatus());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const canManage = useMemo(() => canManageLicense(), []);
  const customerModeLabel = useMemo(() => getCustomerModeLabel(status), [status]);
  const customerModeDescription = useMemo(() => getCustomerModeDescription(status), [status]);
  const customerModeIcon = useMemo(() => getCustomerModeIcon(status), [status]);

  useEffect(() => {
    // sempre valida 1x ao abrir a página (sem polling)
    const run = async () => {
      const st = await getLicenseStatusAsync();
      setStatus(st);
    };
    run();
  }, [enabled]);

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setError(null);
    } catch {
      // fallback simples
      try {
        const el = document.getElementById('deviceIdInput') as HTMLInputElement | null;
        el?.select();
        document.execCommand('copy');
        setError(null);
      } catch {
        setError('Não foi possível copiar. Copie manualmente.');
      }
    }
  };

  const onToggleEnabled = () => {
    if (mandatory) return;
    if (!canManage) return;
    const next = !enabled;
    setFeatureFlag('license', next);
    setEnabled(next);
    // limpa cache para refletir o novo modo
    setStatus(getLicenseStatus());
  };


const importFromFile = async () => {
  try {
    const el = document.getElementById('licenseFileInput') as HTMLInputElement | null;
    el?.click();
  } catch {
    // ignore
  }
};

const onFileSelected = async (file: File | null) => {
  if (!file) return;
  setBusy(true);
  setError(null);
  try {
    const raw = (await file.text()).trim();
    let extracted = raw;
    try {
      const obj = JSON.parse(raw);
      if (typeof obj === 'string') extracted = obj;
      else if (obj?.token) extracted = String(obj.token);
      else if (obj?.licenseToken) extracted = String(obj.licenseToken);
    } catch {
      // raw é o token puro
    }
    setToken(extracted);
    // auto-ativar (melhor UX)
    const res = activateLicense(extracted);
    if (!res.success) {
      setError(res.error || 'Arquivo inválido');
      return;
    }
    const st = await getLicenseStatusAsync();
    setStatus(st);
    if (st.status !== 'active' && st.status !== 'trial') {
      setError(st.message);
    } else {
      setToken('');
    }
  } catch (e: any) {
    setError(e?.message || 'Falha ao importar licença');
  } finally {
    setBusy(false);
  }
};
  const onActivate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = activateLicense(token);
      if (!res.success) {
        setError(res.error || 'Token inválido');
        setBusy(false);
        return;
      }
      const st = await getLicenseStatusAsync();
      setStatus(st);
      if (st.status !== 'active' && st.status !== 'trial') {
        setError(st.message);
      } else {
        setToken('');
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao ativar');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      removeLicense();
      const st = await getLicenseStatusAsync();
      setStatus(st);
      setToken('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="license-page">
      <div className="license-card">
        <div className="license-status-header">
          <div className="license-status-icon" aria-hidden>{statusIcon(status.status)}</div>
          <div>
            <h2>Licença</h2>
            <p className="license-status-message" style={{ color: statusColor(status.status) }}>
              {status.message}
            </p>
          </div>
        </div>

        <div className={`license-visibility-card license-visibility-card--${status.status}`}>
          <div className="license-visibility-icon" aria-hidden>{customerModeIcon}</div>
          <div className="license-visibility-copy">
            <strong>{customerModeLabel}</strong>
            <p>{customerModeDescription}</p>
          </div>
        </div>

        <div className="license-details">
          <div className="license-detail-item">
            <strong>Status comercial</strong>
            <span>{customerModeLabel}</span>
          </div>

          {status.validUntil && (
            <div className="license-detail-item">
              <strong>Validade</strong>
              <span>{isPermanentLicense(status) ? 'Permanente' : new Date(status.validUntil).toLocaleDateString('pt-BR')}</span>
            </div>
          )}

          {typeof status.daysRemaining === 'number' && (
            <div className="license-detail-item">
              <strong>Dias restantes</strong>
              <span>{status.daysRemaining}</span>
            </div>
          )}

          {status.status === 'trial' && typeof status.daysRemaining === 'number' && (
            <div className="license-detail-item">
              <strong>Modo da loja</strong>
              <span>15 dias com acesso liberado para configuração</span>
            </div>
          )}
        </div>

        {status.status !== 'active' && status.status !== 'trial' && (
          <div className="license-warning">
            <p><strong>Como liberar sua loja:</strong></p>
            <p>1) Entre em contato no WhatsApp <b>(43) 99669-4751</b>.</p>
            <p>2) A ativação libera vendas, ordem de serviço, financeiro, backup e suporte.</p>
            <p>3) A liberação é feita pela conta principal, sem expor dados técnicos para o cliente.</p>
          </div>
        )}

        {isRealSuperAdmin && (
          <div className="license-admin-panel">
            <button
              type="button"
              className="btn btn-secondary license-admin-toggle"
              onClick={() => setShowAdminPanel((prev) => !prev)}
            >
              {showAdminPanel ? 'Ocultar painel técnico' : 'Mostrar painel técnico'}
            </button>

            {showAdminPanel && (
              <div className="license-admin-body">
                <div className="license-detail-item">
                  <strong>Machine ID</strong>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      id="deviceIdInput"
                      value={deviceId}
                      readOnly
                      style={{ width: '360px', maxWidth: '65vw' }}
                    />
                    <button className="btn btn-secondary" onClick={copyDeviceId}>
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="license-detail-item">
                  <strong>Bloqueio por licença</strong>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: enabled ? 'var(--success, #10b981)' : 'var(--text-secondary)' }}>
                      {mandatory ? 'OBRIGATÓRIO' : (enabled ? 'ATIVO' : 'DESATIVADO')}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={onToggleEnabled}
                      disabled={!canManage || mandatory}
                      title={mandatory ? 'Neste build a licença é obrigatória' : (!canManage ? 'Apenas admin pode alterar' : undefined)}
                    >
                      {mandatory ? 'Obrigatório' : (enabled ? 'Desativar' : 'Ativar')}
                    </button>
                  </div>
                </div>

                {status.payload?.licenseId && (
                  <div className="license-detail-item">
                    <strong>ID da licença</strong>
                    <span>{status.payload.licenseId}</span>
                  </div>
                )}

                {status.payload?.plan && (
                  <div className="license-detail-item">
                    <strong>Plano</strong>
                    <span>{status.payload.plan}</span>
                  </div>
                )}

                <div className="license-warning">
                  <p><strong>Como ativar:</strong></p>
                  <p>1) Copie o <b>Machine ID</b> e envie no WhatsApp <b>(43) 99669-4751</b>.</p>
                  <p>2) Receba o token de liberação e importe abaixo.</p>
                  <p>3) Confirme se o cliente ficou em trial ou ativado permanente.</p>
                </div>

                <div className="license-form">
                  <div className="form-group">
                    <label>Token da Licença</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0 6px' }}>
                      <button type="button" className="btn btn-secondary" onClick={importFromFile} disabled={busy}>
                        Importar arquivo (.lic)
                      </button>
                      <input
                        id="licenseFileInput"
                        type="file"
                        accept=".lic,.txt,.json"
                        style={{ display: 'none' }}
                        onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Aceita arquivo com token puro ou JSON <code>{'{"token":"..."}'}</code>.
                      </span>
                    </div>
                    <textarea
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      rows={4}
                      placeholder="Cole aqui o token (ex: eyJ2IjoxLCJh... . XyZ...)"
                    />
                  </div>

                  {error && (
                    <div style={{ color: 'var(--error, #ef4444)', fontWeight: 600 }}>
                      {error}
                    </div>
                  )}

                  <div className="license-actions">
                    <button className="btn btn-primary" onClick={onActivate} disabled={busy || !token.trim()}>
                      {busy ? 'Processando…' : 'Ativar licença'}
                    </button>
                    <button className="btn btn-secondary" onClick={onRemove} disabled={busy}>
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="license-info">
        <h3>{isRealSuperAdmin ? 'Vantagens do sistema' : 'Sua loja fica protegida com'}</h3>
        <ul>
          <li>Gestao completa de <b>vendas, ordem de servico, estoque, financeiro e recibos</b> em um so lugar.</li>
          <li>Operacao por <b>loja identificada por store_id</b>, ajudando a evitar mistura de dados entre clientes.</li>
          <li>Fluxo com <b>backup, suporte e ativacao comercial</b> para manter a operacao segura.</li>
          {!isRealSuperAdmin && <li>Trial inicial de 15 dias para configurar a loja com calma antes do bloqueio por ativação.</li>}
          {!isRealSuperAdmin && <li>Atendimento para ativacao e suporte no WhatsApp <b>(43) 99669-4751</b>.</li>}
        </ul>
      </div>
    </div>
  );
}


