import { useEffect, useMemo, useState, useCallback, useDeferredValue } from 'react';
import { fornecedoresRepo } from '@/lib/repositories';
import type { Fornecedor } from '@/types';
import Modal from '@/components/ui/Modal';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { showToast } from '@/components/ui/ToastContainer';
import Pagination from '@/components/ui/Pagination';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import { canCreate, canDelete, canEdit } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import './FornecedoresPage.css';

type FornecedorInput = {
  nome: string;
  site?: string;
  telefone?: string;
  ativo: boolean;
};

const WHATSAPP_MENSAGEM = 'Olá, estou entrando em contato pelo sistema Smart Tech';

function normalizeSite(site?: string) {
  const s = (site || '').trim();
  if (!s) return '';
  return s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`;
}

function newId(): string {
  // Chromium/tauri: crypto.randomUUID disponível
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const ITEMS_PER_PAGE = 18;

function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const deferredBusca = useDeferredValue(busca);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<FornecedorInput>({ nome: '', site: '', telefone: '', ativo: true });
  const [saving, setSaving] = useState(false);
  const readOnly = isReadOnlyMode();
  const canCreateFornecedor = canCreate() && !readOnly;
  const canEditFornecedor = canEdit() && !readOnly;
  const canDeleteFornecedor = canDelete() && !readOnly;

  const resumoFornecedores = useMemo(() => ({
    total: fornecedores.length,
    ativos: fornecedores.filter((f) => !!f.ativo).length,
    inativos: fornecedores.filter((f) => !f.ativo).length,
    comContato: fornecedores.filter((f) => !!(f.telefone || f.site)).length,
  }), [fornecedores]);

  const fornecedoresOrdenados = useMemo(() => {
    const termo = deferredBusca.trim().toLowerCase();
    return [...fornecedores]
      .filter((f) => {
        if (!termo) return true;
        return [f.nome, f.site || '', f.telefone || '']
          .some((value) => String(value || '').toLowerCase().includes(termo));
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fornecedores, deferredBusca]);

  useEffect(() => {
    setCurrentPage(1);
  }, [busca]);

  const totalPages = Math.max(1, Math.ceil(fornecedoresOrdenados.length / ITEMS_PER_PAGE));
  const fornecedoresPaginados = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return fornecedoresOrdenados.slice(start, start + ITEMS_PER_PAGE);
  }, [fornecedoresOrdenados, currentPage]);

  const startIndex = fornecedoresOrdenados.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(fornecedoresOrdenados.length, currentPage * ITEMS_PER_PAGE);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // Offline-first: garantir cache local carregado
      await fornecedoresRepo.preloadLocal();
      setFornecedores(fornecedoresRepo.list());
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar fornecedores', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();

    const atualizar = () => void carregar();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void carregar();
    };

    window.addEventListener('storage', atualizar);
    window.addEventListener('smarttech:sqlite-ready', atualizar as any);
    window.addEventListener('smarttech:store-changed', atualizar as any);
    document.addEventListener('visibilitychange', onVisibility);

    const retry = window.setTimeout(() => void carregar(), 280);

    return () => {
      window.clearTimeout(retry);
      window.removeEventListener('storage', atualizar);
      window.removeEventListener('smarttech:sqlite-ready', atualizar as any);
      window.removeEventListener('smarttech:store-changed', atualizar as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', site: '', telefone: '', ativo: true });
    setModalOpen(true);
  };

  const abrirEditar = (f: Fornecedor) => {
    setEditando(f);
    setForm({
      nome: f.nome,
      site: f.site ?? '',
      telefone: f.telefone ?? '',
      ativo: !!f.ativo
    });
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nome = (form.nome || '').trim();
    if (!nome) {
      showToast('Nome é obrigatório', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editando) {
        const updated: Fornecedor = {
          ...editando,
          nome,
          site: (form.site || '').trim() || undefined,
          telefone: (form.telefone || '').trim() || undefined,
          ativo: !!form.ativo,
          updated_at: new Date().toISOString()
        };
        await fornecedoresRepo.upsert(updated);
        showToast('Fornecedor atualizado.', 'success');
      } else {
        const created: Fornecedor = {
          id: newId(),
          nome,
          site: (form.site || '').trim() || undefined,
          telefone: (form.telefone || '').trim() || undefined,
          ativo: !!form.ativo,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await fornecedoresRepo.upsert(created);
        showToast('Fornecedor cadastrado.', 'success');
      }

      fecharModal();
      await carregar();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar fornecedor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const emptyStateTitle = busca.trim()
    ? 'Nenhum fornecedor corresponde à busca atual.'
    : 'Nenhum fornecedor cadastrado.';
  const emptyStateDescription = busca.trim()
    ? 'Refine o termo digitado ou limpe a busca para ver todos os fornecedores.'
    : 'Cadastre o primeiro fornecedor para centralizar contatos e sites úteis.';

  const handleExcluir = async (f: Fornecedor) => {
    if (!window.confirm(`Excluir o fornecedor "${f.nome}"?`)) return;
    try {
      await fornecedoresRepo.remove(f.id);
      showToast('Fornecedor excluído.', 'success');
      await carregar();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao excluir', 'error');
    }
  };

  return (
    <div className="fornecedores-page page-container">
      <ReadOnlyBanner />
      <div className="page-header">
        <span className="fornecedores-kicker">Cadastros</span>
        <h1>Fornecedores</h1>
        <p>Centralize contatos, sites e disponibilidade dos parceiros em uma visão mais organizada.</p>
      </div>

      <div className="fornecedores-resumo">
        <div className="resumo-card">
          <span className="resumo-label">Total</span>
          <strong>{resumoFornecedores.total}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Ativos</span>
          <strong>{resumoFornecedores.ativos}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Inativos</span>
          <strong>{resumoFornecedores.inativos}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Com contato</span>
          <strong>{resumoFornecedores.comContato}</strong>
        </div>
      </div>

      <div className="fornecedores-actions">
        <Guard
          allowed={canCreateFornecedor}
          mode="disable"
          reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
        >
          <button type="button" className="btn-primary" onClick={abrirNovo} disabled={readOnly}>
            Novo fornecedor
          </button>
        </Guard>
        <div className="fornecedores-search-wrap">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="search-input"
          />
          <div className="fornecedores-meta">
            {busca.trim() ? `Busca ativa para "${busca.trim()}"` : 'Sem busca ativa'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="fornecedores-loading">
          <div className="fornecedores-loading-card">Carregando fornecedores...</div>
        </div>
      ) : fornecedoresOrdenados.length === 0 ? (
        <div className="fornecedores-empty">
          <p className="empty-state-title">{emptyStateTitle}</p>
          <span>{emptyStateDescription}</span>
          {!busca.trim() && (
            <Guard
              allowed={canCreateFornecedor}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
            >
              <button type="button" className="btn-secondary" onClick={abrirNovo} disabled={readOnly}>
                Cadastrar primeiro fornecedor
              </button>
            </Guard>
          )}
        </div>
      ) : (
        <div className="fornecedores-grid">
          {fornecedoresPaginados.map((f) => (
            <div key={f.id} className="fornecedor-card">
              <div className="fornecedor-card-header">
                <h3>{f.nome}</h3>
                {!f.ativo && <span className="fornecedor-inativo">Inativo</span>}
              </div>

              <div className="fornecedor-card-body">
                <div className="fornecedor-meta-badges">
                  <span className={`fornecedor-badge ${f.ativo ? 'is-active' : 'is-inactive'}`}>
                    {f.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  {f.telefone && <span className="fornecedor-badge">WhatsApp</span>}
                  {f.site && <span className="fornecedor-badge">Site</span>}
                </div>

                {f.site && (
                  <div className="fornecedor-row">
                    <a
                      href={normalizeSite(f.site)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fornecedor-link"
                    >
                      Acessar site
                    </a>
                  </div>
                )}

                {f.telefone && (
                  <div className="fornecedor-row fornecedor-telefone">
                    <span>{f.telefone}</span>
                    <WhatsAppIcon
                      telefone={f.telefone}
                      mensagem={WHATSAPP_MENSAGEM}
                      className="fornecedor-whatsapp"
                    />
                  </div>
                )}
              </div>

              <div className="fornecedor-card-actions">
                <Guard allowed={canEditFornecedor} mode="hide">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => abrirEditar(f)}>
                    Editar
                  </button>
                </Guard>
                <Guard allowed={canDeleteFornecedor} mode="hide">
                  <button type="button" className="btn-secondary btn-sm btn-danger" onClick={() => handleExcluir(f)}>
                    Excluir
                  </button>
                </Guard>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        canGoPrev={currentPage > 1}
        canGoNext={currentPage < totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={fornecedoresOrdenados.length}
      />

      <Modal isOpen={modalOpen} onClose={fecharModal} title={editando ? 'Editar fornecedor' : 'Novo fornecedor'}>
        <form onSubmit={handleSubmit} className="fornecedores-form">
          <div className="form-group">
            <label htmlFor="fornecedor-nome">Nome *</label>
            <input
              id="fornecedor-nome"
              type="text"
              value={form.nome}
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do fornecedor"
              required
              autoFocus
              readOnly={readOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor="fornecedor-site">Site</label>
            <input
              id="fornecedor-site"
              type="url"
              value={form.site ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, site: e.target.value }))}
              placeholder="https://..."
              readOnly={readOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor="fornecedor-telefone">Telefone</label>
            <input
              id="fornecedor-telefone"
              type="tel"
              value={form.telefone ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
              placeholder="(43) 99999-9999"
              readOnly={readOnly}
            />
          </div>

          <div className="form-group form-group-checkbox">
            <label>
              <input
                type="checkbox"
                checked={form.ativo ?? true}
                onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                disabled={readOnly}
              />
              Ativo
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={fecharModal}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving || readOnly}>
              {saving ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default FornecedoresPage;
