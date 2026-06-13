import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { Encomenda, StatusEncomenda } from '@/types';
import { getEncomendas, criarEncomenda, atualizarEncomenda, deletarEncomenda } from '@/lib/encomendas';
import { getClientes } from '@/lib/clientes';
import { clientesRepo, encomendasRepo } from '@/lib/repositories';
import { canCreate, canEdit, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import Modal from '@/components/ui/Modal';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import FormField from '@/components/ui/FormField';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import { showToast } from '@/components/ui/ToastContainer';
import Pagination from '@/components/ui/Pagination';
import './EncomendasPage.css';

const ITEMS_PER_PAGE = 12;

function EncomendasPage() {
  const [allEncomendas, setAllEncomendas] = useState<Encomenda[]>([]);
  const [clientes, setClientes] = useState(getClientes());
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusEncomenda | 'todos'>('todos');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredBusca = useDeferredValue(busca);
  const [encomendaEditando, setEncomendaEditando] = useState<Encomenda | null>(null);
  const [formData, setFormData] = useState({
    clienteId: '',
    produto: '',
    quantidade: '',
    fornecedor: '',
    valor: '',
    status: 'solicitada' as StatusEncomenda,
    dataPrevisao: '',
    observacoes: ''
  });

  const carregarEncomendas = useCallback(async () => {
    try {
      await Promise.allSettled([
        encomendasRepo.preloadLocal(),
        clientesRepo.preloadLocal(),
      ]);
      setAllEncomendas(getEncomendas());
      setClientes(getClientes());
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar encomendas.', 'error');
    }
  }, []);

  useEffect(() => {
    void carregarEncomendas();

    let refreshTimer: number | null = null;
    const scheduleRefresh = (mode: 'light' | 'preload' = 'light', delay = 120) => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void carregarEncomendas();
      }, delay);
    };

    const atualizarEncomendas = () => scheduleRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh('light', 80);
    };

    window.addEventListener('storage', atualizarEncomendas);
    window.addEventListener('smart-tech-encomenda-criada', atualizarEncomendas as any);
    window.addEventListener('smart-tech-encomenda-atualizada', atualizarEncomendas as any);
    window.addEventListener('smarttech:sqlite-ready', atualizarEncomendas as any);
    window.addEventListener('smarttech:store-changed', atualizarEncomendas as any);
    document.addEventListener('visibilitychange', onVisibility);

    const retry = window.setTimeout(() => void carregarEncomendas(), 280);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearTimeout(retry);
      window.removeEventListener('storage', atualizarEncomendas);
      window.removeEventListener('smart-tech-encomenda-criada', atualizarEncomendas as any);
      window.removeEventListener('smart-tech-encomenda-atualizada', atualizarEncomendas as any);
      window.removeEventListener('smarttech:sqlite-ready', atualizarEncomendas as any);
      window.removeEventListener('smarttech:store-changed', atualizarEncomendas as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarEncomendas]);

  const clientesOrdenados = useMemo(() => clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)), [clientes]);
  const clientesById = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes]);

  const isStatusFinal = useCallback((status: StatusEncomenda) => ['recebida', 'cancelada', 'pago', 'entregue'].includes(status), []);
  const isAtrasada = useCallback((encomenda: Encomenda) => {
    if (!encomenda.dataPrevisao || isStatusFinal(encomenda.status)) return false;
    const previsao = new Date(encomenda.dataPrevisao);
    previsao.setHours(0, 0, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return previsao.getTime() < hoje.getTime();
  }, [isStatusFinal]);

  const statusResumo = useMemo(() => ({
    total: allEncomendas.length,
    solicitada: allEncomendas.filter((e) => e.status === 'solicitada').length,
    emTransito: allEncomendas.filter((e) => e.status === 'em_transito').length,
    recebida: allEncomendas.filter((e) => e.status === 'recebida').length,
    atrasada: allEncomendas.filter((e) => isAtrasada(e)).length,
    valor: allEncomendas.reduce((acc, item) => acc + (Number(item.valorTotal ?? item.valor) || 0), 0),
  }), [allEncomendas, isAtrasada]);

  const encomendas = useMemo(() => {
    const buscaLower = deferredBusca.trim().toLowerCase();
    let encomendasFiltradas = Array.isArray(allEncomendas) ? [...allEncomendas] : [];

    if (filtroStatus !== 'todos') {
      encomendasFiltradas = encomendasFiltradas.filter((e) => e.status === filtroStatus);
    }

    if (buscaLower) {
      encomendasFiltradas = encomendasFiltradas.filter((e) =>
        e.clienteNome.toLowerCase().includes(buscaLower) ||
        e.produto.toLowerCase().includes(buscaLower) ||
        String(e.fornecedor || '').toLowerCase().includes(buscaLower)
      );
    }

    encomendasFiltradas.sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime());
    return encomendasFiltradas;
  }, [allEncomendas, deferredBusca, filtroStatus]);

  const limparForm = () => {
    setFormData({
      clienteId: '',
      produto: '',
      quantidade: '',
      fornecedor: '',
      valor: '',
      status: 'solicitada',
      dataPrevisao: '',
      observacoes: ''
    });
    setEncomendaEditando(null);
    setMostrarForm(false);
  };


  useEffect(() => {
    setCurrentPage(1);
  }, [busca, filtroStatus]);

  const totalPages = Math.max(1, Math.ceil(encomendas.length / ITEMS_PER_PAGE));
  const encomendasPaginadas = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return encomendas.slice(start, start + ITEMS_PER_PAGE);
  }, [encomendas, currentPage]);

  const startIndex = encomendas.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(encomendas.length, currentPage * ITEMS_PER_PAGE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cliente = getClientes().find(c => c.id === formData.clienteId);

    if (!cliente) {
      showToast('Selecione um cliente.', 'warning');
      return;
    }

    const quantidade = parseInt(formData.quantidade, 10);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      showToast('Informe uma quantidade válida maior que zero.', 'warning');
      return;
    }

    const encomendaData = {
      clienteId: formData.clienteId,
      clienteNome: cliente.nome,
      produto: formData.produto,
      quantidade,
      fornecedor: formData.fornecedor || undefined,
      valor: formData.valor ? parseFloat(formData.valor) : undefined,
      status: formData.status,
      // Campo obrigatório no schema
      dataSolicitacao: encomendaEditando?.dataSolicitacao || new Date().toISOString(),
      dataPrevisao: formData.dataPrevisao || undefined,
      dataRecebimento: formData.status === 'recebida' ? new Date().toISOString() : undefined,
      observacoes: formData.observacoes || undefined
    };

    try {
      if (encomendaEditando) {
        const saved = await atualizarEncomenda(encomendaEditando.id, encomendaData);
        if (!saved) {
          showToast('Falha ao salvar encomenda. O financeiro local foi preservado sem divergência.', 'error');
          return;
        }
      } else {
        const saved = await criarEncomenda(encomendaData);
        if (!saved) {
          showToast('Falha ao criar encomenda.', 'error');
          return;
        }
      }

      await carregarEncomendas();
      limparForm();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao salvar encomenda.', 'error');
    }
  };

  const handleEditar = (encomenda: Encomenda) => {
    setEncomendaEditando(encomenda);
    setFormData({
      clienteId: encomenda.clienteId,
      produto: encomenda.produto,
      quantidade: encomenda.quantidade.toString(),
      fornecedor: encomenda.fornecedor || '',
      valor: encomenda.valor?.toString() || '',
      status: encomenda.status,
      dataPrevisao: encomenda.dataPrevisao || '',
      observacoes: encomenda.observacoes || ''
    });
    setMostrarForm(true);
  };

  const handleDeletar = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta encomenda?')) {
      try {
        await deletarEncomenda(id);
        await carregarEncomendas();
      } catch (error: any) {
        showToast(error?.message || 'Erro ao excluir encomenda.', 'error');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getStatusLabel = (status: StatusEncomenda) => {
    const labels = {
      solicitada: 'Solicitada',
      em_transito: 'Em Trânsito',
      recebida: 'Recebida',
      cancelada: 'Cancelada',
      pago: 'Pago',
      entregue: 'Entregue'
    };
    return labels[status];
  };

  const getStatusClass = (status: StatusEncomenda) => {
    return `status-badge status-${status}`;
  };

  const filtroStatusLabel = filtroStatus === 'todos' ? 'todas as encomendas' : getStatusLabel(filtroStatus);
  const emptyStateTitle = busca.trim()
    ? 'Nenhuma encomenda corresponde à busca atual.'
    : filtroStatus === 'todos'
      ? 'Nenhuma encomenda encontrada.'
      : `Nenhuma encomenda em ${filtroStatusLabel}.`;
  const emptyStateDescription = busca.trim()
    ? 'Refine o termo digitado ou limpe a busca para visualizar mais resultados.'
    : filtroStatus === 'todos'
      ? 'Cadastre uma encomenda para começar a acompanhar esse fluxo.'
      : 'Altere o filtro para revisar outros status.';
  const emptyStateActionLabel = busca.trim() ? 'Limpar busca' : '+ Nova Encomenda';

  const readOnly = isReadOnlyMode();
  const canCreateEnc = canCreate() && !readOnly;
  const canEditEnc = canEdit() && !readOnly;
  const canDeleteEnc = canDelete() && !readOnly;

  return (
    <div className="encomendas-page">
      <ReadOnlyBanner />
      <div className="page-header">
        <div>
          <h1>Encomendas</h1>
          <p>Acompanhe solicitações, trânsito e recebimento com mais clareza.</p>
        </div>
        <Guard 
          allowed={canCreateEnc}
          mode="disable"
          reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
        >
          <button
            className="btn-primary"
            onClick={() => {
              limparForm();
              setMostrarForm(true);
            }}
          >
            + Nova Encomenda
          </button>
        </Guard>
      </div>

      <Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title={encomendaEditando ? 'Editar Encomenda' : 'Nova Encomenda'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="standard-form">
          <div className="form-grid">
            <FormField label="Cliente" required>
              <select
                required
                value={formData.clienteId}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, clienteId: e.target.value });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="">Selecione...</option>
                {clientesOrdenados.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Produto" required>
              <input
                type="text"
                required
                value={formData.produto}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, produto: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Quantidade" required>
              <input
                type="number"
                min="1"
                required
                value={formData.quantidade}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, quantidade: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Fornecedor">
              <input
                type="text"
                value={formData.fornecedor}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, fornecedor: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Valor">
              <input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, valor: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Status" required>
              <select
                required
                value={formData.status}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, status: e.target.value as StatusEncomenda });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="solicitada">Solicitada</option>
                <option value="em_transito">Em Trânsito</option>
                <option value="recebida">Recebida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </FormField>
            <FormField label="Previsão de Entrega">
              <input
                type="date"
                value={formData.dataPrevisao}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, dataPrevisao: e.target.value });
                }}
                className="form-input"
                disabled={readOnly}
              />
            </FormField>
          </div>
          <FormField label="Observações" fullWidth>
            <textarea
              value={formData.observacoes}
              onChange={(e) => {
                if (readOnly) return;
                setFormData({ ...formData, observacoes: e.target.value });
              }}
              rows={3}
              className="form-textarea"
              readOnly={readOnly}
            />
          </FormField>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={limparForm}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {encomendaEditando ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="resumo-encomendas">
        <div className="resumo-card highlight">
          <span className="resumo-label">Valor estimado</span>
          <strong>{formatCurrency(statusResumo.valor)}</strong>
          <span className="resumo-helper">Soma das encomendas cadastradas.</span>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Total</span>
          <strong>{statusResumo.total}</strong>
          <span className="resumo-helper">Fluxos ativos para acompanhamento.</span>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Solicitadas</span>
          <strong>{statusResumo.solicitada}</strong>
          <span className="resumo-helper">Aguardando avanço do fornecedor.</span>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Em trânsito</span>
          <strong>{statusResumo.emTransito}</strong>
          <span className="resumo-helper">Itens ainda em deslocamento.</span>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Recebidas</span>
          <strong>{statusResumo.recebida}</strong>
          <span className="resumo-helper">Prontas para entrega ou baixa.</span>
        </div>
        <div className="resumo-card warning">
          <span className="resumo-label">Atrasadas</span>
          <strong>{statusResumo.atrasada}</strong>
          <span className="resumo-helper">Com previsão vencida e sem status final.</span>
        </div>
      </div>

      <div className="filtros-bar">
        <div className="filtros-topo">
          <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar encomendas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="search-input"
          />
          </div>
          <div className="filtros-meta">
            {busca.trim() ? `Busca ativa para "${busca.trim()}"` : 'Sem busca ativa'}
          </div>
        </div>
        <div className="filtros-status">
          <button
            className={`filtro-btn ${filtroStatus === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('todos')}
          >
            Todos ({statusResumo.total})
          </button>
          <button
            className={`filtro-btn ${filtroStatus === 'solicitada' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('solicitada')}
          >
            Solicitadas ({statusResumo.solicitada})
          </button>
          <button
            className={`filtro-btn ${filtroStatus === 'em_transito' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('em_transito')}
          >
            Em Trânsito ({statusResumo.emTransito})
          </button>
          <button
            className={`filtro-btn ${filtroStatus === 'recebida' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('recebida')}
          >
            Recebidas ({statusResumo.recebida})
          </button>
        </div>
        <div className="filtros-resumo">
          Exibindo <strong>{encomendas.length}</strong> de <strong>{statusResumo.total}</strong> encomendas
        </div>
      </div>

      <div className="encomendas-grid">
        {encomendas.length === 0 ? (
          <div className="empty-state encomendas-empty-state">
            <p className="empty-state-title">{emptyStateTitle}</p>
            <span>{emptyStateDescription}</span>
            {canCreateEnc ? (
              <button
                type="button"
                className="btn-primary encomendas-empty-action"
                onClick={() => {
                  if (busca.trim()) {
                    setBusca('');
                    setFiltroStatus('todos');
                    return;
                  }
                  limparForm();
                  setMostrarForm(true);
                }}
              >
                {emptyStateActionLabel}
              </button>
            ) : null}
          </div>
        ) : (
          encomendasPaginadas.map(encomenda => {
            const cliente = clientesById.get(encomenda.clienteId);
            const telefone = cliente?.telefone;
            const valorEncomenda = Number(encomenda.valorTotal ?? encomenda.valor) || 0;
            const atrasada = isAtrasada(encomenda);

            return (
              <div key={encomenda.id} className={`encomenda-card ${atrasada ? 'encomenda-card-atrasada' : ''}`}>
                <div className="encomenda-header">
                  <div className="encomenda-title-block">
                    <h3>{encomenda.produto}</h3>
                    <div className="encomenda-meta-row">
                      <span className={getStatusClass(encomenda.status)}>
                        {getStatusLabel(encomenda.status)}
                      </span>
                      {atrasada ? <span className="status-badge status-atrasada">Atrasada</span> : null}
                      {encomenda.fornecedor ? <span className="encomenda-chip">{encomenda.fornecedor}</span> : null}
                      {valorEncomenda > 0 ? <span className="encomenda-chip muted">{formatCurrency(valorEncomenda)}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="encomenda-info">
                  <div className="encomenda-detail-row">
                    <span className="encomenda-detail-label">Cliente</span>
                    <span className="encomenda-detail-value">{encomenda.clienteNome}</span>
                  </div>
                  <div className="encomenda-detail-row inline">
                    <div>
                      <span className="encomenda-detail-label">Quantidade</span>
                      <span className="encomenda-detail-value">{encomenda.quantidade}</span>
                    </div>
                    {encomenda.dataPrevisao ? (
                      <div>
                        <span className="encomenda-detail-label">Previsão</span>
                        <span className="encomenda-detail-value">{formatDate(encomenda.dataPrevisao)}</span>
                      </div>
                    ) : null}
                  </div>
                  {encomenda.observacoes ? (
                    <div className="encomenda-detail-row encomenda-notes">
                      <span className="encomenda-detail-label">Observações</span>
                      <span className="encomenda-detail-value">{encomenda.observacoes}</span>
                    </div>
                  ) : null}
                  <div className="encomenda-footer">
                    <span className="encomenda-data"><strong>Solicitada em:</strong> {formatDate(encomenda.dataSolicitacao)}</span>
                    <span className="encomenda-footer-note">{telefone ? 'WhatsApp disponível' : 'Sem telefone cadastrado'}</span>
                  </div>
                </div>
                <div className="encomenda-actions">
                  {telefone ? (
                    <WhatsAppButton 
                      telefone={telefone} 
                      mensagem={`Olá! Sobre a encomenda: ${encomenda.produto} - Quantidade: ${encomenda.quantidade} - Status: ${getStatusLabel(encomenda.status)}`}
                    />
                  ) : null}
                  <Guard 
                    allowed={canEditEnc}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleEditar(encomenda)}
                      aria-label="Editar"
                      title="Editar encomenda"
                    >
                      ✏️
                    </button>
                  </Guard>
                  <Guard 
                    allowed={canDeleteEnc}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleDeletar(encomenda.id)}
                      aria-label="Deletar"
                      title="Excluir encomenda"
                    >
                      🗑️
                    </button>
                  </Guard>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        canGoPrev={currentPage > 1}
        canGoNext={currentPage < totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={encomendas.length}
      />
    </div>
  );
}

export default EncomendasPage;
