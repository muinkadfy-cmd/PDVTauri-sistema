import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateId } from '@/lib/storage';
import { isSuperAdmin } from '@/lib/auth-supabase';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { setStoreId } from '@/lib/store-id';
import { showToast } from '@/components/ui/ToastContainer';
import {
  createAdminStore,
  listAdminLicenses,
  listAdminStores,
  type StoreAdminLicenseRow,
  type StoreAdminRow,
  upsertAdminLicense
} from '@/lib/capabilities/store-admin-remote-adapter';
import './LojasPage.css';

type StoreRow = StoreAdminRow;
type LicenseRow = StoreAdminLicenseRow;

function getLicenseToneClass(tone: 'success' | 'warning' | 'error') {
  if (tone === 'success') return 'lojas-license-badge is-success';
  if (tone === 'warning') return 'lojas-license-badge is-warning';
  return 'lojas-license-badge is-error';
}

export default function LojasPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [licensesByStore, setLicensesByStore] = useState<Record<string, LicenseRow | null>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const activeStoreId = getRuntimeStoreId();

  async function load() {
    setLoading(true);
    try {
      const data = await listAdminStores();
      setStores(data as any);

      const storeIds = data.map((r) => r.id).filter(Boolean);
      if (!storeIds.length) {
        setLicensesByStore({});
        return;
      }

      const licData = await listAdminLicenses(storeIds);
      const map: Record<string, LicenseRow | null> = {};
      for (const sid of storeIds) map[sid] = null;
      licData.forEach((row: any) => {
        const prev = map[row.store_id];
        const prevT = prev?.updated_at || prev?.created_at || '';
        const curT = row.updated_at || row.created_at || '';
        if (!prev || (curT && curT > prevT)) map[row.store_id] = row as any;
      });
      setLicensesByStore(map);
    } catch (error: any) {
      showToast(`Erro ao carregar lojas: ${error?.message || 'Erro desconhecido'}`, 'error');
      setStores([]);
      setLicensesByStore({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Proteção simples no front; segurança real é RLS
    if (!isSuperAdmin()) {
      showToast('Acesso restrito: SuperAdmin', 'error');
      navigate('/configuracoes');
      return;
    }
    load();
      }, []);


  function formatLicense(lic: LicenseRow | null) {
    if (!lic) return { label: 'Sem licença', tone: 'error' as const, days: undefined as number | undefined };
    const status = (lic.status || '').toLowerCase();
    const plan = (lic.plan || '').toLowerCase();
    if (status === 'blocked') return { label: 'Bloqueada', tone: 'error' as const, days: 0 };
    if (plan === 'lifetime' || lic.expires_at == null) return { label: 'Permanente', tone: 'success' as const, days: undefined };
    const exp = new Date(lic.expires_at);
    const now = new Date();
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: `Expirada (${exp.toLocaleDateString('pt-BR')})`, tone: 'error' as const, days: 0 };
    if (days <= 7) return { label: `Expira em ${days} dia(s)`, tone: 'warning' as const, days };
    return { label: `Ativa (${exp.toLocaleDateString('pt-BR')})`, tone: 'success' as const, days };
  }

  async function setActingFor(storeId: string, v: boolean) {
    setActing((p) => ({ ...p, [storeId]: v }));
  }

  async function upsertLicense(storeId: string, payload: Partial<LicenseRow>) {
    await setActingFor(storeId, true);
    try {
      await upsertAdminLicense(storeId, payload);
      showToast('✅ Licença atualizada!', 'success');
      await load();
    } catch (error: any) {
      showToast(`Erro ao atualizar licença: ${error?.message || 'Erro desconhecido'}`, 'error');
    } finally {
      await setActingFor(storeId, false);
    }
  }

  async function actionTrial7(storeId: string) {
    const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await upsertLicense(storeId, { plan: 'trial', status: 'active', expires_at: exp });
  }

  async function actionLifetime(storeId: string) {
    await upsertLicense(storeId, { plan: 'lifetime', status: 'active', expires_at: null });
  }

  async function actionBlock(storeId: string) {
    const prev = licensesByStore[storeId];
    // manter expires_at, mas status bloqueado
    await upsertLicense(storeId, { plan: prev?.plan || 'trial', status: 'blocked', expires_at: prev?.expires_at ?? null });
  }

  async function actionUnblock(storeId: string) {
    const prev = licensesByStore[storeId];
    // se expirou, reativa com 7 dias por padrão
    const plan = prev?.plan || 'trial';
    let expires_at = prev?.expires_at ?? null;
    if (plan !== 'lifetime' && expires_at) {
      const exp = new Date(expires_at);
      if (exp < new Date()) {
        expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    }
    await upsertLicense(storeId, { plan, status: 'active', expires_at });
  }

  async function createStore() {
    const n = (name || '').trim();
    if (!n) {
      showToast('Informe o nome da loja', 'error');
      return;
    }

    // Validações defensivas (não-quebra): evita payload inválido e mensagens 400 genéricas
    if (n.length < 3) {
      showToast('Nome da loja muito curto (mínimo 3 caracteres)', 'error');
      return;
    }
    if (n.length > 80) {
      showToast('Nome da loja muito longo (máximo 80 caracteres)', 'error');
      return;
    }
    setCreating(true);
    const id = generateId();
    try {
      await createAdminStore(id, n);
      showToast('✅ Loja criada com sucesso!', 'success');
      setName('');
      await load();
    } catch (error: any) {
      // Ajuda prática para erros comuns (RLS / coluna / trigger)
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('row level security') || msg.includes('rls')) {
        showToast('Erro ao criar loja: bloqueado por RLS. Verifique policies da tabela stores.', 'error');
      } else if (msg.includes('violates') && msg.includes('not-null')) {
        showToast('Erro ao criar loja: campos obrigatórios ausentes (verifique trigger bootstrap_store_defaults).', 'error');
      } else {
        showToast(`Erro ao criar loja: ${error?.message || 'Erro desconhecido'}`, 'error');
      }
    } finally {
      setCreating(false);
    }
  }

  function accessStore(storeId: string) {
    setStoreId(storeId, { force: true, reason: 'superadmin-access-store' });
    navigate(`/painel?store=${encodeURIComponent(storeId)}`);
    showToast('Entrando no painel da loja selecionada.', 'success');
  }

  return (
    <div className="lojas-page page-container">
      <div className="page-header lojas-header">
        <div>
          <div className="lojas-kicker">SuperAdmin</div>
          <h1>Lojas</h1>
          <p className="page-subtitle">
            Crie novas lojas, envie o link de acesso e controle a licença de cada cliente sem misturar operações.
          </p>
        </div>
        <button className="btn-secondary lojas-header-button" onClick={() => navigate('/configuracoes')}>
          Voltar
        </button>
      </div>

      <section className="lojas-overview">
        <article className="lojas-overview-card">
          <span className="lojas-overview-label">Lojas registradas</span>
          <strong>{stores.length}</strong>
          <p>Base total sob gestão da conta principal.</p>
        </article>
        <article className="lojas-overview-card">
          <span className="lojas-overview-label">Ativas</span>
          <strong>{stores.filter((store) => (licensesByStore[store.id]?.status || '').toLowerCase() !== 'blocked').length}</strong>
          <p>Licenças liberadas para operação.</p>
        </article>
        <article className="lojas-overview-card">
          <span className="lojas-overview-label">Bloqueadas</span>
          <strong>{stores.filter((store) => (licensesByStore[store.id]?.status || '').toLowerCase() === 'blocked').length}</strong>
          <p>Lojas pausadas por decisão administrativa.</p>
        </article>
      </section>

      <section className="config-card lojas-section">
        <div className="lojas-section-head">
          <div>
            <h2>Criar nova loja</h2>
            <p>O banco gera a estrutura inicial da empresa e da licença no bootstrap.</p>
          </div>
        </div>
        <div className="lojas-create-row">
          <input
            className="search-input lojas-create-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da loja, exemplo: Smart Tech Londrina"
          />
          <button className="btn-primary lojas-create-button" onClick={createStore} disabled={creating}>
            {creating ? 'Criando...' : 'Criar loja'}
          </button>
        </div>
        <p className="lojas-section-note">
          Depois de criada, você pode copiar o link <code>/s/STORE_ID</code> e ativar ou bloquear a licença quando quiser.
        </p>
      </section>

      <section className="config-card lojas-section">
        <div className="lojas-section-head">
          <div>
            <h2>Minhas lojas</h2>
            <p>Gerencie acesso, onboarding e situação comercial de cada cliente.</p>
          </div>
          <span className="lojas-section-count">{loading ? '...' : `${stores.length} loja(s)`}</span>
        </div>

        {loading ? (
          <div className="lojas-empty">Carregando lojas...</div>
        ) : stores.length === 0 ? (
          <div className="lojas-empty">
            <strong className="empty-state-title">Nenhuma loja cadastrada ainda.</strong>
            <span>Crie a primeira loja para começar a distribuir o sistema com store_id separado por cliente.</span>
          </div>
        ) : (
          <div className="lojas-grid">
            {stores.map((s) => {
              const licenseInfo = formatLicense(licensesByStore[s.id] || null);
              const blocked = ((licensesByStore[s.id]?.status || '').toLowerCase() === 'blocked');
              return (
                <article key={s.id} className="lojas-store-card">
                  <div className="lojas-store-head">
                    <div>
                      <h3>{s.name}</h3>
                      <div className="lojas-store-id">{s.id}</div>
                    </div>
                    <div className="lojas-store-head-badges">
                      {activeStoreId === s.id ? (
                        <span className="lojas-active-badge">Loja atual</span>
                      ) : null}
                      <span className={getLicenseToneClass(licenseInfo.tone)}>{licenseInfo.label}</span>
                    </div>
                  </div>

                  <div className="lojas-store-meta">
                    <div className="lojas-store-link">
                      <span className="lojas-meta-label">Link do cliente</span>
                      <code>/s/{s.id}</code>
                    </div>
                    <button
                      className="btn-secondary lojas-copy-button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`/s/${s.id}`);
                          showToast('Link copiado!', 'success');
                        } catch {
                          showToast('Não foi possível copiar. Copie manualmente.', 'error');
                        }
                      }}
                    >
                      Copiar link
                    </button>
                  </div>

                  <div className="lojas-actions">
                    <button className="btn-primary" disabled={!!acting[s.id]} onClick={() => accessStore(s.id)}>
                      Acessar loja
                    </button>
                    <button className="btn-secondary" disabled={!!acting[s.id]} onClick={() => actionTrial7(s.id)}>
                      {acting[s.id] ? 'Aguarde...' : 'Trial 7d'}
                    </button>
                    <button className="btn-secondary" disabled={!!acting[s.id]} onClick={() => actionLifetime(s.id)}>
                      Permanente
                    </button>
                    {blocked ? (
                      <button className="btn-primary" disabled={!!acting[s.id]} onClick={() => actionUnblock(s.id)}>
                        Reativar
                      </button>
                    ) : (
                      <button className="btn-danger" disabled={!!acting[s.id]} onClick={() => actionBlock(s.id)}>
                        Bloquear
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
