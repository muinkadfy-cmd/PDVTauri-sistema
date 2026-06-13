import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDeviceId } from '@/lib/device';
import { activateFromToken, getLicenseStatus, getLicenseStatusAsync, type LicenseStatus } from '@/lib/license';
import { isDesktopApp } from '@/lib/platform';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { closePlatformWindow } from '@/lib/capabilities/desktop-window-adapter';
import './BuyPage.css';

const WHATSAPP_E164 = '5543996694751'; // +55 43 99669-4751
const ACTIVATION_PHONE = '(43) 99669-4751';

function buildWhatsappUrl(message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_E164}?text=${text}`;
}

export default function BuyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const deviceId = useMemo(() => getDeviceId(), []);
  const [status, setStatus] = useState<LicenseStatus>(() => getLicenseStatus());
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [activating, setActivating] = useState(false);
  const [tokenOk, setTokenOk] = useState('');
  const [tokenErr, setTokenErr] = useState('');
  const [needsRestart, setNeedsRestart] = useState(false);

  useEffect(() => {
    setBusy(true);
    getLicenseStatusAsync()
      .then((st) => setStatus(st))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (busy) return;
    if (status.status !== 'active' && status.status !== 'trial') return;

    const timer = window.setTimeout(() => {
      navigate(from || '/painel', { replace: true });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [busy, status.status, navigate, from]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(el);
    }
  };

  const pasteFromClipboard = async () => {
    setTokenErr('');
    setTokenOk('');
    try {
      const txt = await navigator.clipboard.readText();
      if (txt?.trim()) setToken(txt.trim());
    } catch {}
  };

  const activateToken = async () => {
    setTokenErr('');
    setTokenOk('');
    setNeedsRestart(false);

    const t = token.trim();
    if (!t) {
      setTokenErr('Cole o token de ativacao para liberar o acesso.');
      return;
    }

    setActivating(true);
    try {
      const res = await activateFromToken(t);
      if (res.ok) {
        try {
          const st = await getLicenseStatusAsync();
          setStatus(st);
        } catch {}
        setToken('');
        setNeedsRestart(true);
        setTokenOk('Licenca ativada com sucesso.');
      } else {
        setTokenErr(res.error || 'Nao foi possivel ativar. Verifique o token.');
      }
    } catch (e) {
      setTokenErr(String(e));
    } finally {
      setActivating(false);
    }
  };

  const msg = `Olá! Quero ativar o Smart Tech PDV.\n\nID da máquina: ${deviceId}\n\nQuero liberar a loja para continuar usando:\n- vendas e cadastro\n- ordem de servico\n- fluxo de caixa e cobrancas\n- backup e suporte\n\nPode me orientar na ativacao?`;
  const waUrl = buildWhatsappUrl(msg);

  const closeDesktopApp = async () => {
    try {
      await closePlatformWindow();
      return;
    } catch {}
  };

  return (
    <div className="buy-root">
      <div className="buy-card" role="region" aria-label="Compra e ativacao">
        <div className="buy-top">
          <div className="buy-badge">Smart Tech PDV</div>
          <div className="buy-title">
            <div className="buy-h1">Ativacao necessaria</div>
            <div className="buy-sub">
              {status.status === 'expired' ? 'Os 15 dias de teste terminaram.' : 'Use os 15 dias de trial para configurar tudo. Depois disso, a ativacao sera exigida para continuar operando.'}
              {isDesktopApp() ? ' (Desktop)' : ''}
            </div>
          </div>

          <div className="buy-status">
            <div className={`buy-pill buy-pill-${status.status}`}>
              <span className="dot" aria-hidden />
              <span>{busy ? 'Validando...' : status.message}</span>
            </div>
          </div>
        </div>

        <div className="buy-grid">
          <section className="buy-section">
            <div className="buy-label">ID da maquina</div>

            <div className="buy-idbox">
              <code className="buy-id" title={deviceId}>{deviceId}</code>
              <div className="buy-actions">
                <button className="btn btn-secondary" type="button" onClick={() => void copy(deviceId)}>
                  Copiar ID
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => void openExternalUrl(waUrl)}>
                  Abrir WhatsApp
                </button>
              </div>
            </div>

            <div className="buy-hint">Envie o ID acima no WhatsApp {ACTIVATION_PHONE} para liberar o sistema.</div>

            <div className="buy-divider" />

            <div className="buy-subtitle">Ja tem o token de ativacao?</div>
            <div className="buy-hint" style={{ marginTop: 6 }}>
              Cole o token abaixo para liberar o acesso sem sair desta tela.
            </div>

            <textarea
              className="buy-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole aqui o token de ativacao"
              spellCheck={false}
            />

            <div className="buy-actions" style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" type="button" onClick={() => void pasteFromClipboard()}>
                Colar do clipboard
              </button>
              <button className="btn btn-primary" type="button" onClick={() => void activateToken()} disabled={activating}>
                {activating ? 'Ativando...' : 'Ativar token'}
              </button>
            </div>

            {tokenErr ? <div className="buy-msg buy-msg-error">{tokenErr}</div> : null}
            {tokenOk ? (
              <div className="buy-msg buy-msg-ok buy-msg-ok-strong">
                <div className="buy-msg-title">{tokenOk}</div>
                {needsRestart ? (
                  <>
                    <div className="buy-msg-sub">
                      Para aplicar em todas as telas, <b>feche o aplicativo</b> e <b>abra novamente</b>.
                    </div>
                    <div className="buy-msg-actions">
                      {isDesktopApp() ? (
                        <button className="btn btn-primary" type="button" onClick={() => void closeDesktopApp()}>
                          Fechar aplicativo agora
                        </button>
                      ) : null}
                      <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>
                        Recarregar
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="buy-section buy-offer">
            <div className="buy-label">Ativacao comercial</div>
            <div className="offer-badge" aria-hidden="true">WhatsApp direto</div>

            <div className="buy-price" aria-label="Contato de ativacao">
              <span className="new">{ACTIVATION_PHONE}</span>
            </div>

            <p className="buy-offer-text">
              Fale direto no <strong>WhatsApp</strong> para ativar a loja e manter o sistema liberado para operacao.
            </p>

            <p className="buy-offer-compare">
              Vantagens do sistema:
              <span className="muted"> vendas, ordem de servico, financeiro, recibos, backup, multi-loja e operacao local com sincronizacao.</span>
            </p>

            <button className="btn btn-primary buy-cta" type="button" onClick={() => void openExternalUrl(waUrl)}>
              Ativar pelo WhatsApp
            </button>

            <button className="btn btn-secondary buy-alt" type="button" onClick={() => void copy(waUrl)}>
              Copiar link WhatsApp
            </button>
          </section>
        </div>

        <div className="buy-foot">
          <div className="buy-foot-note">
            {status.status === 'trial' && status.daysRemaining != null ? (
              <>Voce ainda esta no trial de 15 dias por {status.daysRemaining} dia(s). Aproveite para configurar a loja e, depois do prazo, fale conosco para ativar.</>
            ) : (
              <>
                {status.status === 'active'
                  ? 'Licenca ativa. Redirecionando para o sistema...'
                  : 'Depois da ativacao, feche e abra o aplicativo para liberar o acesso.'}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
