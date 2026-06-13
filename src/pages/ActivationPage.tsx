import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getDeviceId } from '@/lib/device';
import { isLicenseEnabled, isLicenseMandatory, canToggleLicenseFlag, setFeatureFlag } from '@/lib/mode';
import {
  activateLicense,
  canManageLicense,
  getLicenseStatus,
  getLicenseStatusAsync,
  removeLicense,
  type LicenseStatus,
} from '@/lib/license';
import './ActivationPage.css';

function statusIcon(s: LicenseStatus['status']) {
  switch (s) {
    case 'active': return '✅';
    case 'trial': return '🆓';
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

export default function ActivationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;

  const deviceId = useMemo(() => getDeviceId(), []);
  const mandatory = useMemo(() => isLicenseMandatory(), []);
  const [enabled, setEnabled] = useState(isLicenseEnabled());
  const [status, setStatus] = useState<LicenseStatus>(() => getLicenseStatus());
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => canManageLicense(), []);

  useEffect(() => {
    // valida 1x ao abrir
    const run = async () => {
      try {
        const st = await getLicenseStatusAsync();
        setStatus(st);
      } catch {
        // ignore
      }
    };
    run();
  }, [enabled]);

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setError(null);
    } catch {
      try {
        const el = document.getElementById('actDeviceId') as HTMLInputElement | null;
        el?.select();
        document.execCommand('copy');
        setError(null);
      } catch {
        setError('Não foi possível copiar. Copie manualmente.');
      }
    }
  };


const importFromFile = async () => {
  try {
    const el = document.getElementById('licenseFileInputAct') as HTMLInputElement | null;
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
    if (st.status !== 'active') {
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
        return;
      }
      const st = await getLicenseStatusAsync();
      setStatus(st);
      if (st.status !== 'active') {
        setError(st.message);
        return;
      }
      setToken('');
      // Após ativar, segue para a rota original (se houver) ou painel.
      navigate(from || '/painel', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Falha ao ativar');
    } finally {
      setBusy(false);
    }
  };

  const onEnter = () => {
    // Em build de venda, só entra após ativar.
    if (mandatory && status.status !== 'active' && status.status !== 'trial') {
      setError('Ative a licença para continuar.');
      return;
    }
    navigate(from || '/painel', { replace: true });
  };

  const onEnableBlocking = () => {
    // Se for build de venda (licença obrigatória), este botão não deve aparecer.
    if (mandatory || !canToggleLicenseFlag()) return;
    const next = true;
    setFeatureFlag('license', next);
    setEnabled(next);
    setStatus(getLicenseStatus());
  };

  const onRemove = async () => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      removeLicense();
      const st = await getLicenseStatusAsync();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="activation-root">
      <div className="activation-card">
        <div className="activation-header">
          <div className="activation-icon" aria-hidden>{statusIcon(status.status)}</div>
          <div>
            <h1>Ativação do Sistema</h1>
            <div className="activation-sub" style={{ color: statusColor(status.status) }}>
              {status.message}
            </div>
          </div>
        </div>

        {!enabled && !mandatory && (
          <div className="activation-warning">
            <b>Bloqueio por licença está DESATIVADO.</b>
            <div style={{ opacity: 0.9, marginTop: 6 }}>
              Se este computador é de um cliente (venda), ative o bloqueio para exigir licença.
            </div>
            <button className="btn btn-primary" onClick={onEnableBlocking} style={{ marginTop: 10 }}>
              Ativar bloqueio por licença
            </button>
          </div>
        )}

        {mandatory && (
          <div className="activation-warning">
            <b>Build de venda: licença obrigatória.</b>
            <div style={{ opacity: 0.9, marginTop: 6 }}>
              Ative a licença para liberar o acesso ao sistema.
            </div>
          </div>
        )}

        <div className="activation-section">
          <div className="activation-label">Machine ID</div>
          <div className="activation-row">
            <input id="actDeviceId" value={deviceId} readOnly />
            <button className="btn btn-secondary" onClick={copyDeviceId}>Copiar</button>
          </div>
          <div className="activation-help">
            1) Copie o <b>Machine ID</b> e envie para o admin (você).<br />
            2) O admin gera o token e você cola abaixo.
          </div>
        </div>

        <div className="activation-section">
          <div className="activation-label">Token da Licença</div>
<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '10px 0 8px' }}>
  <button type="button" className="btn btn-secondary" onClick={importFromFile} disabled={busy}>
    Importar arquivo (.lic)
  </button>
  <input
    id="licenseFileInputAct"
    type="file"
    accept=".lic,.txt,.json"
    style={{ display: 'none' }}
    onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
  />
  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
    Aceita token puro (texto) ou JSON com {"{ token: \"...\" }"}.
  </span>
</div>

          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={5}
            placeholder="Cole aqui o token (payload.assinatura)"
          />
        </div>

        {error && <div className="activation-error">{error}</div>}

        <div className="activation-actions">
          <button
            className="btn btn-primary"
            onClick={onActivate}
            disabled={busy || !token.trim()}
          >
            {busy ? 'Validando…' : 'Ativar licença'}
          </button>
          <button className="btn btn-secondary" onClick={onEnter} disabled={mandatory && status.status !== 'active' && status.status !== 'trial'}>
            {mandatory && status.status !== 'active' && status.status !== 'trial' ? 'Aguardando ativação' : 'Entrar'}
          </button>
          {canManage && (
            <button className="btn btn-secondary" onClick={onRemove} disabled={busy} title="Apenas admin">
              Remover
            </button>
          )}
        </div>

        <div className="activation-footer">
          <div>
            <b>Dica:</b> O token é ligado ao Machine ID. Se limpar dados do navegador, o ID pode mudar.
          </div>
        </div>
      </div>
    </div>
  );
}
