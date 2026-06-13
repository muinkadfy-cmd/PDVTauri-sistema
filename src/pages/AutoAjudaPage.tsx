import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/components/ui/ToastContainer';
import Modal from '@/components/ui/Modal';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { BUILD_DATE, BUILD_VERSION } from '@/config/buildInfo';
import { getClientId } from '@/lib/tenant';
import { getDeviceId } from '@/lib/device';
import { getCurrentSession } from '@/lib/auth-supabase';
import { isGzipSupported, saveBackup } from '@/lib/backup';
import { hardRepairPWA } from '@/lib/pwa-repair';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import './AutoAjudaPage.css';

const WHATSAPP_SUPORTE = '5543996694751'; // (43) 99669-4751

function calcLocalStorageBytes(): number {
  try {
    if (typeof window === 'undefined') return 0;
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const v = localStorage.getItem(k) || '';
      // 2 bytes por char (UTF-16) aprox
      total += (k.length + v.length) * 2;
    }
    return total;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function AutoAjudaPage() {
  const navigate = useNavigate();
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [showConfirmPwa, setShowConfirmPwa] = useState(false);
  const [showConfirmTemp, setShowConfirmTemp] = useState(false);

  const session = getCurrentSession();
  const storeId = getRuntimeStoreId();
  const clientId = getClientId();
  const deviceId = getDeviceId();

  const info = useMemo(() => {
    const online = isBrowserOnlineSafe();
    const lsBytes = calcLocalStorageBytes();
    return {
      online,
      lsBytes,
      lsHuman: formatBytes(lsBytes),
      role: session?.role || '—',
      user: session?.username || '—',
      storeId: storeId || '—',
      clientId: clientId || '—',
      deviceId: deviceId || '—',
    };
  }, [session?.role, session?.username, storeId, clientId, deviceId]);

  useEffect(() => {
    // dica rápida ao entrar
    // (não spammar)
    try {
      const key = 'smart-tech:autoajuda:visited';
      const last = localStorage.getItem(key);
      if (!last) {
        localStorage.setItem(key, new Date().toISOString());
        showToast('🛟 Autoajuda: aqui você faz Backup, Diagnóstico e Reparo rápido em 1 clique.', 'info', 5000);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleBackupAgora = async () => {
    if (loadingBackup) return;
    setLoadingBackup(true);
    try {
      const compress = isGzipSupported();
      const res = await saveBackup(true, { compress });
      if (res.success) {
        showToast(`✅ Backup criado (${res.method === 'folder' ? 'pasta' : 'download'})${res.filename ? `: ${res.filename}` : ''}`, 'success');
      } else {
        showToast(`❌ Falha ao criar backup: ${res.error || 'erro desconhecido'}`, 'error', 7000);
      }
    } catch (e: any) {
      showToast(`❌ Erro ao criar backup: ${e?.message || String(e)}`, 'error', 7000);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleCopiarRelatorio = async () => {
    const report = [
      `Smart Tech PDV - Relatório Rápido`,
      `Versão: ${BUILD_VERSION}`,
      `Build: ${BUILD_DATE}`,
      `Online: ${info.online ? 'SIM' : 'NÃO'}`,
      `Usuário: ${info.user}`,
      `Role: ${info.role}`,
      `StoreId: ${info.storeId}`,
      `ClientId: ${info.clientId}`,
      `DeviceId: ${info.deviceId}`,
      `LocalStorage aprox: ${info.lsHuman}`,
      `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : '—'}`,
      `Data: ${new Date().toISOString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      showToast('📋 Relatório copiado. Cole no WhatsApp do suporte.', 'success');
    } catch {
      // fallback
      try {
        const ta = document.createElement('textarea');
        ta.value = report;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('📋 Relatório copiado. Cole no WhatsApp do suporte.', 'success');
      } catch {
        showToast('⚠️ Não consegui copiar. Tente manualmente ou use o Diagnóstico.', 'warning', 6000);
      }
    }
  };

  const limparCachesTemporarios = () => {
    try {
      // NÃO apaga dados do sistema. Apenas chaves leves de UI/estado.
      localStorage.removeItem('smart-tech-sidebar-collapsed');
      localStorage.removeItem('smart-tech-last-sync');
      localStorage.removeItem('smart-tech-last-sync-error');
      localStorage.removeItem('smart-tech-tema');
    } catch {
      // ignore
    }
    try {
      sessionStorage.removeItem('smart-tech:pending-update-reload');
    } catch {
      // ignore
    }
    showToast('🧹 Cache temporário limpo. Recomendado reiniciar o app.', 'success');
  };

  const handleReiniciar = () => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  };

  const handleLimparCachePwa = async () => {
    setShowConfirmPwa(false);

    // Aviso: limpar caches pode exigir internet para recarregar assets.
    if (!isBrowserOnlineSafe()) {
      showToast('⚠️ Você está sem internet. Limpar cache PWA pode impedir abrir o app até voltar a conexão.', 'warning', 9000);
    } else {
      showToast('🔄 Limpando cache do app e reiniciando...', 'info', 4000);
    }

    await hardRepairPWA();
  };

  const suporteMensagem = useMemo(() => {
    const msg = [
      `Olá! Preciso de ajuda no Smart Tech PDV.`,
      `Versão: ${BUILD_VERSION}`,
      `Online: ${info.online ? 'SIM' : 'NÃO'}`,
      `Usuário: ${info.user} (${info.role})`,
      `StoreId: ${info.storeId}`,
      `ClientId: ${info.clientId}`,
      `LocalStorage: ${info.lsHuman}`,
      `Descreva o problema:`
    ].join('\n');
    return msg;
  }, [info.online, info.user, info.role, info.storeId, info.clientId, info.lsHuman]);

  return (
    <div className="autoajuda-page">
      <div className="page-header">
        <h1>🛟 Autoajuda</h1>
        <p className="subtitle">
          Botões rápidos para resolver problemas sem complicação (sem apagar seus dados).
        </p>
      </div>

      <div className="status-card">
        <div className="status-grid">
          <div><span>Versão</span><strong>{BUILD_VERSION}</strong></div>
          <div><span>Online</span><strong className={info.online ? 'ok' : 'bad'}>{info.online ? 'SIM' : 'NÃO'}</strong></div>
          <div><span>Usuário</span><strong>{info.user}</strong></div>
          <div><span>Perfil</span><strong>{info.role}</strong></div>
          <div><span>Store</span><strong className="mono">{info.storeId}</strong></div>
          <div><span>Armazenamento</span><strong>{info.lsHuman}</strong></div>
        </div>
      </div>

      <div className="cards">
        <div className="card">
          <h2>💾 Backup rápido</h2>
          <p>Recomendado fazer backup antes de qualquer reparo. (Inclui anexos offline.)</p>

          <div className="actions">
            <button className="btn primary" onClick={handleBackupAgora} disabled={loadingBackup}>
              {loadingBackup ? 'Criando backup...' : 'Fazer backup agora'}
            </button>
            <button className="btn" onClick={() => navigate('/backup')}>
              Abrir backup avançado
            </button>
          </div>

          <div className="hint">
            <strong>Dica:</strong> Faça backup todo dia antes de fechar o caixa.
          </div>
        </div>

        <div className="card">
          <h2>🧪 Diagnóstico</h2>
          <p>Quando algo “some” (OS, vendas) ou o sistema fica lento, use os diagnósticos.</p>

          <div className="actions">
            <button className="btn" onClick={() => navigate('/diagnostico')}>
              Diagnóstico rápido
            </button>
            <button className="btn" onClick={() => navigate('/diagnostico-dados')}>
              Diagnóstico de dados
            </button>
            <button className="btn" onClick={() => navigate('/diagnostico-rotas')}>
              Diagnóstico de rotas
            </button>
            <button className="btn" onClick={() => navigate('/atualizacoes')}>
              Atualizações do app
            </button>
          </div>

          <div className="actions">
            <button className="btn subtle" onClick={handleCopiarRelatorio}>
              📋 Copiar relatório pro suporte
            </button>
          </div>
        </div>

        <div className="card">
          <h2>🛠️ Reparo rápido</h2>
          <p>Essas ações não apagam seus dados do sistema. Só limpam cache e reiniciam o app.</p>

          <div className="actions">
            <button className="btn" onClick={() => setShowConfirmTemp(true)}>
              🧹 Limpar cache temporário (UI)
            </button>
            <button className="btn" onClick={handleReiniciar}>
              🔁 Reiniciar app
            </button>
            <button className="btn danger" onClick={() => setShowConfirmPwa(true)}>
              🧨 Limpar cache PWA (recomendado)
            </button>
          </div>

          <div className="hint warn">
            <strong>Atenção:</strong> “Limpar cache PWA” pode exigir internet para abrir novamente.
          </div>
        </div>

        <div className="card">
          <h2>📞 Suporte</h2>
          <p>Se continuar com problemas, envie uma mensagem com o relatório.</p>

          <div className="actions">
            <WhatsAppButton telefone={WHATSAPP_SUPORTE} mensagem={suporteMensagem} />
            <button className="btn subtle" onClick={handleCopiarRelatorio}>
              Copiar relatório
            </button>
          </div>

          <div className="hint">
            <strong>Checklist pra suporte:</strong> diga a tela, o passo a passo e mande print do erro.
          </div>
        </div>
      </div>

      <Modal
        isOpen={showConfirmPwa}
        onClose={() => setShowConfirmPwa(false)}
        title="Limpar cache do app (PWA)"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setShowConfirmPwa(false)}>Cancelar</button>
            <button className="btn danger" onClick={handleLimparCachePwa}>Limpar cache e reiniciar</button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <p>
            Isso faz um “reparo hard”: remove Service Worker + limpa caches + reinicia o app.
            <br />
            <strong>Se estiver sem internet, pode precisar conectar para abrir novamente.</strong>
          </p>
          <p>✅ Seus dados locais (clientes, produtos, OS, vendas) não são apagados.</p>
        </div>
      </Modal>

      <Modal
        isOpen={showConfirmTemp}
        onClose={() => setShowConfirmTemp(false)}
        title="Limpar cache temporário"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setShowConfirmTemp(false)}>Cancelar</button>
            <button className="btn primary" onClick={() => { setShowConfirmTemp(false); limparCachesTemporarios(); }}>
              Limpar agora
            </button>
          </div>
        }
      >
        <p>
          Remove apenas caches leves (UI/estado). Não apaga dados do sistema.
          Recomendado se o menu “bugar” ou ficar lento.
        </p>
      </Modal>
    </div>
  );
}
