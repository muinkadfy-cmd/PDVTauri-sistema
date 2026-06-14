import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Devolucao } from '@/types';
import { getDevolucoes, criarDevolucao, deletarDevolucao } from '@/lib/devolucoes';
import { getVendas } from '@/lib/vendas';
import { getClientes } from '@/lib/clientes';
import { canCreate, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import Modal from '@/components/ui/Modal';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import FormField from '@/components/ui/FormField';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import { formatVendaId, formatDevolucaoId } from '@/lib/format-display-id';
import { showToast } from '@/components/ui/ToastContainer';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import './DevolucaoPage.css';

function DevolucaoPage() {
  const [devolucoes, setDevolucoes] = useState<Devolucao[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingTimer = useRef<number | null>(null);
  const reloadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formData, setFormData] = useState({
    vendaId: '',
    clienteId: '',
    motivo: '',
    valorDevolvido: '',
    observacoes: ''
  });
  const [itens, setItens] = useState<Array<{ produtoId: string; produtoNome: string; quantidade: number }>>([]);
  const deferredBusca = useDeferredValue(busca);

  const carregarDevolucoes = useCallback(async () => {
    const seq = ++reloadSeq.current;
    const shouldShowLoading = !hasLoadedOnce.current;

    try {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    } catch {}
    if (shouldShowLoading) {
      loadingTimer.current = window.setTimeout(() => {
        if (seq === reloadSeq.current) setLoading(true);
      }, 180);
    }

    try {
      const list = getDevolucoes();
      if (seq !== reloadSeq.current) return;
      setDevolucoes(Array.isArray(list) ? list : []);
    } finally {
      if (seq !== reloadSeq.current) return;
      try {
        if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      } catch {}
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarDevolucoes();

    const onChanged = () => void carregarDevolucoes();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void carregarDevolucoes();
    };

    window.addEventListener('storage', onChanged);
    window.addEventListener('smart-tech-devolucao-criada', onChanged as any);
    window.addEventListener('smart-tech-devolucao-deletada', onChanged as any);
    window.addEventListener('smart-tech-venda-criada', onChanged as any);
    window.addEventListener('smarttech:sqlite-ready', onChanged as any);
    window.addEventListener('smarttech:store-changed', onChanged as any);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      try {
        if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      } catch {}
      window.removeEventListener('storage', onChanged);
      window.removeEventListener('smart-tech-devolucao-criada', onChanged as any);
      window.removeEventListener('smart-tech-devolucao-deletada', onChanged as any);
      window.removeEventListener('smart-tech-venda-criada', onChanged as any);
      window.removeEventListener('smarttech:sqlite-ready', onChanged as any);
      window.removeEventListener('smarttech:store-changed', onChanged as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarDevolucoes]);

  const devolucoesExibidas = useMemo(() => {
    let list = Array.isArray(devolucoes) ? [...devolucoes] : [];
    const q = deferredBusca.trim().toLowerCase();
    if (q) {
      list = list.filter(d =>
        d.clienteNome.toLowerCase().includes(q) ||
        d.motivo.toLowerCase().includes(q) ||
        (d.vendaNumero || '').toLowerCase().includes(q) ||
        (d.observacoes || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return list;
  }, [devolucoes, deferredBusca]);

  const resumo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return {
      total: devolucoes.length,
      totalValor: devolucoes.reduce((acc, item) => acc + (Number(item.valorDevolvido) || 0), 0),
      hoje: devolucoes.filter((item) => {
        const data = new Date(item.data);
        data.setHours(0, 0, 0, 0);
        return data.getTime() === hoje.getTime();
      }).length,
      comObservacoes: devolucoes.filter((item) => item.observacoes?.trim()).length,
      itens: devolucoes.reduce((acc, item) => acc + item.itens.reduce((sum, current) => sum + (Number(current.quantidade) || 0), 0), 0),
    };
  }, [devolucoes]);

  const emptyStateTitle = busca.trim()
    ? 'Nenhuma devolução encontrada para a busca atual.'
    : 'Nenhuma devolução cadastrada ainda.';
  const emptyStateMessage = busca.trim()
    ? 'Refine o termo digitado ou limpe a busca para visualizar todas as devoluções.'
    : 'Registre a primeira devolução para acompanhar estornos com mais clareza.';

  const limparForm = () => {
    setFormData({
      vendaId: '',
      clienteId: '',
      motivo: '',
      valorDevolvido: '',
      observacoes: ''
    });
    setItens([]);
    setMostrarForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cliente = getClientes().find(c => c.id === formData.clienteId);
    const venda = getVendas().find(v => v.id === formData.vendaId);

    if (!cliente) {
      showToast('⚠️ Selecione um cliente.', 'warning');
      return;
    }

    if (!formData.vendaId || !venda) {
      showToast('⚠️ Selecione a venda que está sendo devolvida.', 'warning');
      return;
    }

    const valorDevolvido = parseFloat(formData.valorDevolvido) || 0;
    if (valorDevolvido <= 0) {
      showToast('⚠️ Informe um valor devolvido válido.', 'warning');
      return;
    }
    const totalVenda = (venda as any).total_liquido ?? (venda as any).total_final ?? venda.total ?? 0;
    if (valorDevolvido > totalVenda + 0.01) {
      showToast(`⚠️ Valor devolvido (${valorDevolvido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) não pode ser maior que o total da venda (${totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`, 'error');
      return;
    }

    await criarDevolucao({
      vendaId: formData.vendaId,
      vendaNumero: venda ? (venda.numero_venda ? `V-${venda.numero_venda}` : formatVendaId(venda.id)) : undefined,
      clienteId: formData.clienteId,
      clienteNome: cliente.nome,
      motivo: formData.motivo,
      itens: itens,
      valorDevolvido: parseFloat(formData.valorDevolvido) || 0,
      observacoes: formData.observacoes || undefined
    });

    void carregarDevolucoes();
    limparForm();
  };

  const passwordPrompt = usePasswordPrompt();

  const handleDeletar = async (id: string) => {
    passwordPrompt.requestPassword(() => executarExclusaoDevolucao(id));
  };

  const executarExclusaoDevolucao = async (id: string) => {
    const sucesso = await deletarDevolucao(id);
    if (sucesso) {
      showToast('✅ Devolução excluída e estornada no fluxo de caixa!', 'success');
      void carregarDevolucoes();
    } else {
      showToast('❌ Erro ao excluir devolução.', 'error');
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

  const formatCurrency = (valor: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);

  const clientes = getClientes();
  const vendas = getVendas();

  const readOnly = isReadOnlyMode();
  const canCreateDev = canCreate() && !readOnly;
  const canDeleteDev = canDelete() && !readOnly;

  return (
    <div className="devolucao-page">
      <ReadOnlyBanner />
      <div className="page-header devolucao-header-premium">
        <div>
          <h1>Devoluções</h1>
          <p>Registre estornos com contexto claro para operação, caixa e atendimento.</p>
        </div>
        <Guard
          allowed={canCreateDev}
          mode="disable"
          reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
        >
          <button
            className="btn-primary page-action-button devolucao-create-button"
            onClick={() => {
              limparForm();
              setMostrarForm(true);
            }}
          >
            + Nova Devolução
          </button>
        </Guard>
      </div>

      <Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title="Nova Devolução"
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
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Venda" required>
              <select
                value={formData.vendaId}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, vendaId: e.target.value });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="">Selecione...</option>
                {vendas.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.clienteNome || 'Cliente não informado'} - {formatCurrency(v.total)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Valor Devolvido" required>
              <input
                type="number"
                step="0.01"
                required
                value={formData.valorDevolvido}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, valorDevolvido: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Motivo" required>
              <input
                type="text"
                required
                value={formData.motivo}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, motivo: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
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
              Criar
            </button>
          </div>
        </form>
      </Modal>

      <div className="devolucao-summary-grid">
        <div className="devolucao-summary-card highlight">
          <span className="summary-label">Valor devolvido</span>
          <strong>{formatCurrency(resumo.totalValor)}</strong>
          <span className="summary-helper">Total consolidado das devoluções registradas.</span>
        </div>
        <div className="devolucao-summary-card">
          <span className="summary-label">Devoluções</span>
          <strong>{resumo.total}</strong>
          <span className="summary-helper">Ocorrências disponíveis para consulta.</span>
        </div>
        <div className="devolucao-summary-card">
          <span className="summary-label">Hoje</span>
          <strong>{resumo.hoje}</strong>
          <span className="summary-helper">Estornos lançados no dia atual.</span>
        </div>
        <div className="devolucao-summary-card">
          <span className="summary-label">Itens devolvidos</span>
          <strong>{resumo.itens}</strong>
          <span className="summary-helper">Quantidade total informada nas devoluções.</span>
        </div>
      </div>

      <div className="devolucao-toolbar">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar por cliente, motivo, venda ou observações..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="devolucao-toolbar-meta">
          <span>{busca.trim() ? `Busca ativa para “${busca.trim()}”` : 'Sem busca ativa'}</span>
          <strong>{devolucoesExibidas.length}</strong>
          <span>de {resumo.total} devoluções</span>
          <span className="devolucao-toolbar-divider">•</span>
          <span>{resumo.comObservacoes} com observações</span>
        </div>
      </div>

      {!hasLoadedOnce.current ? (
        <div className="st-list-reserve" aria-hidden="true" />
      ) : loading ? (
        <div className="devolucoes-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="devolucao-card devolucao-card-skeleton" aria-hidden="true">
              <div className="devolucao-skeleton-line devolucao-skeleton-title" />
              <div className="devolucao-skeleton-line" />
              <div className="devolucao-skeleton-line short" />
              <div className="devolucao-skeleton-line" />
            </div>
          ))}
        </div>
      ) : devolucoesExibidas.length === 0 ? (
        <div className="empty-state devolucao-empty-state">
          <div className="empty-state-icon" aria-hidden="true">↩️</div>
          <p className="empty-state-title">{emptyStateTitle}</p>
          <span>{emptyStateMessage}</span>
          {canCreateDev ? (
            <button
              type="button"
              className="btn-primary page-action-button devolucao-empty-action"
              onClick={() => {
                limparForm();
                setMostrarForm(true);
              }}
            >
              + Registrar devolução
            </button>
          ) : null}
        </div>
      ) : (
        <div className="devolucoes-grid">
          {devolucoesExibidas.map(devolucao => {
            const cliente = clientes.find(c => c.id === devolucao.clienteId);
            const telefone = cliente?.telefone;
            const itensDevolvidos = devolucao.itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

            return (
              <div key={devolucao.id} className="devolucao-card">
                <div className="devolucao-header">
                  <div className="devolucao-title-block">
                    <h3>{devolucao.clienteNome}</h3>
                    <div className="devolucao-meta-row">
                      <span className="devolucao-chip">{formatDevolucaoId(devolucao.id)}</span>
                      {devolucao.vendaNumero ? <span className="devolucao-chip">{devolucao.vendaNumero}</span> : null}
                      {itensDevolvidos > 0 ? <span className="devolucao-chip muted">{itensDevolvidos} item(ns)</span> : null}
                    </div>
                  </div>
                  <div className="devolucao-actions">
                    {telefone ? (
                      <WhatsAppButton
                        telefone={telefone}
                        mensagem={`Olá! Sobre a devolução - Valor: ${formatCurrency(devolucao.valorDevolvido)} - Motivo: ${devolucao.motivo}`}
                      />
                    ) : null}
                    <Guard
                      allowed={canDeleteDev}
                      mode="hide"
                    >
                      <button
                        className="btn-icon"
                        onClick={() => handleDeletar(devolucao.id)}
                        aria-label="Deletar"
                        title="Excluir devolução"
                      >
                        🗑️
                      </button>
                    </Guard>
                  </div>
                </div>

                <div className="devolucao-info">
                  <p className="devolucao-valor">{formatCurrency(devolucao.valorDevolvido)}</p>
                  <div className="devolucao-detail-row">
                    <span className="devolucao-detail-label">Motivo</span>
                    <span className="devolucao-detail-value">{devolucao.motivo}</span>
                  </div>
                  {devolucao.observacoes ? (
                    <div className="devolucao-detail-row devolucao-detail-notes">
                      <span className="devolucao-detail-label">Observações</span>
                      <span className="devolucao-detail-value">{devolucao.observacoes}</span>
                    </div>
                  ) : null}
                  <div className="devolucao-footer">
                    <span className="devolucao-data"><strong>Data:</strong> {formatDate(devolucao.data)}</span>
                    <span className="devolucao-footer-note">{telefone ? 'WhatsApp disponível' : 'Sem telefone cadastrado'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={passwordPrompt.handleClose}
        onConfirm={passwordPrompt.handleConfirm}
        title="🔐 Confirmar Exclusão de Devolução"
        message="⚠️ Esta ação irá excluir a devolução e reverter o estorno no fluxo de caixa. Digite a senha para confirmar:"
      />
    </div>
  );
}

export default DevolucaoPage;
