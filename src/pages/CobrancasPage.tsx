import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cobranca, StatusCobranca } from '@/types';
import { getCobrancas, criarCobranca, atualizarCobranca, deletarCobranca } from '@/lib/cobrancas';
import { getClientes, criarCliente } from '@/lib/clientes';
import { canCreate, canEdit, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import Modal from '@/components/ui/Modal';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import PrintButton from '@/components/ui/PrintButton';
import FormField from '@/components/ui/FormField';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import { showToast } from '@/components/ui/ToastContainer';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import ClientAutocomplete from '@/components/ui/ClientAutocomplete';
import { printReceipt } from '@/services/print/receipt-service';
import FinanceMetricsCards from '@/components/FinanceMetricsCards';
import { getMetrics, criarPeriodoPorTipo } from '@/lib/metrics';
import './CobrancasPage.css';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonList from '@/components/ui/SkeletonList';

const PERIOD_LABELS: Record<'hoje' | '7dias' | 'mes' | 'personalizado', string> = {
  hoje: 'Hoje',
  '7dias': '7 dias',
  mes: 'Mês',
  personalizado: 'Personalizado',
};

function CobrancasPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingTimer = useRef<number | null>(null);
  const reloadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusCobranca | 'todos'>('todos');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [cobrancaEditando, setCobrancaEditando] = useState<Cobranca | null>(null);
  const [clientes, setClientes] = useState(getClientes());
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '', email: '' });
  const passwordPrompt = usePasswordPrompt();
  const [formData, setFormData] = useState({
    clienteId: '',
    descricao: '',
    valor: '',
    vencimento: '',
    status: 'pendente' as StatusCobranca,
    formaPagamento: 'dinheiro' as 'dinheiro' | 'cartao' | 'pix' | 'outro',
    observacoes: ''
  });

  // Métricas Financeiras
  const [periodoTipo, setPeriodoTipo] = useState<'hoje' | '7dias' | 'mes' | 'personalizado'>('mes');
  const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });

  const carregarCobrancas = useCallback(async () => {
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
      setClientes(getClientes());
      const list = getCobrancas();
      if (seq !== reloadSeq.current) return;
      setCobrancas(Array.isArray(list) ? list : []);
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
    void carregarCobrancas();

    const atualizarCobrancas = () => void carregarCobrancas();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void carregarCobrancas();
    };

    window.addEventListener('storage', atualizarCobrancas);
    window.addEventListener('smart-tech-cobranca-criada', atualizarCobrancas as any);
    window.addEventListener('smart-tech-cobranca-atualizada', atualizarCobrancas as any);
    window.addEventListener('smart-tech-cobranca-deletada', atualizarCobrancas as any);
    window.addEventListener('smart-tech-movimentacao-criada', atualizarCobrancas as any);
    window.addEventListener('smart-tech-backup-restored', atualizarCobrancas as any);
    window.addEventListener('smarttech:sqlite-ready', atualizarCobrancas as any);
    window.addEventListener('smarttech:store-changed', atualizarCobrancas as any);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      try {
        if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      } catch {}
      window.removeEventListener('storage', atualizarCobrancas);
      window.removeEventListener('smart-tech-cobranca-criada', atualizarCobrancas as any);
      window.removeEventListener('smart-tech-cobranca-atualizada', atualizarCobrancas as any);
      window.removeEventListener('smart-tech-cobranca-deletada', atualizarCobrancas as any);
      window.removeEventListener('smart-tech-movimentacao-criada', atualizarCobrancas as any);
      window.removeEventListener('smart-tech-backup-restored', atualizarCobrancas as any);
      window.removeEventListener('smarttech:sqlite-ready', atualizarCobrancas as any);
      window.removeEventListener('smarttech:store-changed', atualizarCobrancas as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarCobrancas]);

  const cobrancasFiltradas = useMemo(() => {
    let list = Array.isArray(cobrancas) ? [...cobrancas] : [];

    if (filtroStatus !== 'todos') {
      list = list.filter(c => c.status === filtroStatus);
    }

    const q = busca.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.clienteNome.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
    return list;
  }, [cobrancas, busca, filtroStatus]);

  // Calcular métricas baseado no período selecionado
  const metrics = useMemo(() => {
    let periodo;
    if (periodoTipo === 'personalizado' && periodoCustom.inicio && periodoCustom.fim) {
      periodo = criarPeriodoPorTipo(periodoTipo, new Date(periodoCustom.inicio), new Date(periodoCustom.fim));
    } else {
      periodo = criarPeriodoPorTipo(periodoTipo);
    }
    
    return getMetrics({
      origem: 'COBRANCA',
      from: periodo.inicio,
      to: periodo.fim
    });
  }, [periodoTipo, periodoCustom]);

  const limparForm = () => {
    setFormData({
      clienteId: '',
      descricao: '',
      valor: '',
      vencimento: '',
      status: 'pendente',
      formaPagamento: 'dinheiro',
      observacoes: ''
    });
    setCobrancaEditando(null);
    setMostrarForm(false);
  };

  const limparFormCliente = () => {
    setFormCliente({ nome: '', telefone: '', email: '' });
    setMostrarFormCliente(false);
  };

  const handleCriarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCliente.nome?.trim()) {
      showToast('Nome do cliente é obrigatório.', 'warning');
      return;
    }
    const novoCliente = await criarCliente({
      nome: formCliente.nome.trim(),
      telefone: formCliente.telefone?.trim() || undefined,
      email: formCliente.email?.trim() || undefined
    });
    if (novoCliente) {
      showToast('Cliente criado com sucesso!', 'success');
      setClientes(getClientes());
      setFormData(prev => ({ ...prev, clienteId: novoCliente.id }));
      limparFormCliente();
    } else {
      showToast('Erro ao criar cliente.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cliente = clientes.find(c => c.id === formData.clienteId);

    if (!cliente) {
      showToast('Selecione um cliente.', 'warning');
      return;
    }

    // FIX 8: Bloquear cobrança com valor inválido
    const valorCobranca = parseFloat(formData.valor);
    if (!valorCobranca || valorCobranca <= 0) {
      showToast('⚠️ O valor da cobrança deve ser maior que R$ 0,00.', 'warning');
      return;
    }

    const cobrancaData = {
      clienteId: formData.clienteId,
      clienteNome: cliente.nome,
      descricao: formData.descricao,
      valor: valorCobranca,
      vencimento: formData.vencimento,
      status: formData.status,
      formaPagamento: formData.status === 'paga' ? formData.formaPagamento : undefined,
      dataPagamento: formData.status === 'paga' ? new Date().toISOString() : undefined,
      observacoes: formData.observacoes || undefined
    };

    const saved = cobrancaEditando
      ? await atualizarCobranca(cobrancaEditando.id, cobrancaData)
      : await criarCobranca(cobrancaData);

    if (!saved) {
      await carregarCobrancas();
      showToast(
        cobrancaEditando
          ? 'Falha ao salvar cobrança. Nenhuma alteração foi confirmada no financeiro local.'
          : 'Falha ao criar cobrança. O registro não foi persistido no banco local.',
        'error'
      );
      return;
    }

    showToast(cobrancaEditando ? 'Cobrança atualizada.' : 'Cobrança criada com sucesso!', 'success');
    await carregarCobrancas();
    limparForm();
  };

  const handleEditar = (cobranca: Cobranca) => {
    setCobrancaEditando(cobranca);
    setFormData({
      clienteId: cobranca.clienteId,
      descricao: cobranca.descricao,
      valor: cobranca.valor.toString(),
      vencimento: cobranca.vencimento,
      status: cobranca.status,
      formaPagamento: cobranca.formaPagamento || 'dinheiro',
      observacoes: cobranca.observacoes || ''
    });
    setMostrarForm(true);
  };

  const handleDeletar = async (id: string) => {
    const cobranca = cobrancas.find((item) => item.id === id);
    if (!cobranca) return;

    passwordPrompt.requestPassword(async () => {
      const removed = await deletarCobranca(id);
      await carregarCobrancas();

      if (!removed) {
        showToast('Falha ao excluir cobrança. Se ela estiver paga, confira se o estorno financeiro foi criado.', 'error');
        return;
      }

      showToast('Cobrança excluída.', 'success');
    });
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

  const formatarMensagemCobranca = (cobranca: Cobranca, comprovantePago: boolean): string => {
    if (comprovantePago && cobranca.status === 'paga') {
      return `✅ *COMPROVANTE DE PAGAMENTO*\n\n` +
        `*Cliente:* ${cobranca.clienteNome}\n` +
        `*Descrição:* ${cobranca.descricao}\n` +
        `*Valor:* ${formatCurrency(cobranca.valor)}\n` +
        `*Forma de pagamento:* ${cobranca.formaPagamento || 'Não informado'}\n` +
        (cobranca.dataPagamento ? `*Data do pagamento:* ${formatDate(cobranca.dataPagamento)}\n` : '') +
        (cobranca.observacoes ? `*Observações:* ${cobranca.observacoes}\n` : '');
    }
    return `Olá! Lembro sobre a cobrança: ${cobranca.descricao} - Valor: ${formatCurrency(cobranca.valor)} - Vencimento: ${formatDate(cobranca.vencimento)}`;
  };

  const handleImprimir = (cobranca: Cobranca, compact: boolean = false) => {
    void compact;
    void printReceipt({ type: 'charge', id: cobranca.id });
  };

  const getStatusLabel = (status: StatusCobranca) => {
    const labels = {
      pendente: 'Pendente',
      paga: 'Paga',
      vencida: 'Vencida',
      cancelada: 'Cancelada'
    };
    return labels[status];
  };

  const getStatusClass = (status: StatusCobranca) => {
    return `status-badge status-${status}`;
  };

  const readOnly = isReadOnlyMode();
  const canCreateCob = canCreate() && !readOnly;
  const canEditCob = canEdit() && !readOnly;
  const canDeleteCob = canDelete() && !readOnly;

  return (
    <div className="cobrancas-page">
      <ReadOnlyBanner />
      
<PageHeader
  kicker="Financeiro"
  title="Cobranças"
  subtitle="Acompanhe, registre e organize cobranças por status."
  actions={
    <Guard
      allowed={canCreateCob}
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
        Nova cobrança
      </button>
    </Guard>
  }
/>

      <Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title={cobrancaEditando ? 'Editar Cobrança' : 'Nova Cobrança'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="standard-form">
          <div className="form-grid">
            <FormField label="Cliente" required>
              <ClientAutocomplete
                clientes={clientes}
                value={formData.clienteId}
                onChange={(clienteId) => setFormData({ ...formData, clienteId })}
                onNewClient={!cobrancaEditando && !readOnly ? () => setMostrarFormCliente(true) : undefined}
                onQuickCreate={async (nome) => {
                  const c = await criarCliente({ nome: nome.trim() });
                  if (c) {
                    showToast('Cliente criado com sucesso!', 'success');
                    setClientes(getClientes());
                    setFormData(prev => ({ ...prev, clienteId: c.id }));
                  } else {
                    showToast('Erro ao criar cliente.', 'error');
                  }
                }}
                disabled={readOnly}
                required
                placeholder="Digite o nome do cliente..."
              />
            </FormField>
            <FormField label="Valor" required>
              <input
                type="number"
                step="0.01"
                required
                value={formData.valor}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, valor: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Vencimento" required>
              <input
                type="date"
                required
                value={formData.vencimento}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, vencimento: e.target.value });
                }}
                className="form-input"
                disabled={readOnly}
              />
            </FormField>
            <FormField label="Status" required>
              <select
                required
                value={formData.status}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, status: e.target.value as StatusCobranca });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="pendente">Pendente</option>
                <option value="paga">Paga</option>
                <option value="vencida">Vencida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </FormField>
            {formData.status === 'paga' && (
              <FormField label="Forma de Pagamento">
                <select
                  value={formData.formaPagamento}
                  onChange={(e) => {
                    if (readOnly) return;
                    setFormData({ ...formData, formaPagamento: e.target.value as any });
                  }}
                  className="form-input"
                  disabled={readOnly}
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="pix">PIX</option>
                  <option value="outro">Outro</option>
                </select>
              </FormField>
            )}
            <FormField label="Descrição" required>
              <input
                type="text"
                required
                value={formData.descricao}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, descricao: e.target.value });
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
              {cobrancaEditando ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>


      <section className="st-section" style={{ marginBottom: 16 }}>
        <div className="st-chip-row" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          {(['hoje', '7dias', 'mes'] as const).map((periodo) => (
            <button
              key={periodo}
              type="button"
              className={`st-chip ${periodoTipo === periodo ? 'is-active' : ''}`}
              onClick={() => setPeriodoTipo(periodo)}
            >
              {PERIOD_LABELS[periodo]}
            </button>
          ))}
          <button
            type="button"
            className={`st-chip ${periodoTipo === 'personalizado' ? 'is-active' : ''}`}
            onClick={() => setPeriodoTipo('personalizado')}
          >
            {PERIOD_LABELS.personalizado}
          </button>
        </div>

        {periodoTipo === 'personalizado' && (
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <FormField label="Início">
              <input
                type="date"
                value={periodoCustom.inicio}
                onChange={(e) => setPeriodoCustom((prev) => ({ ...prev, inicio: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label="Fim">
              <input
                type="date"
                value={periodoCustom.fim}
                onChange={(e) => setPeriodoCustom((prev) => ({ ...prev, fim: e.target.value }))}
                className="form-input"
              />
            </FormField>
          </div>
        )}

        <FinanceMetricsCards
          title="Recebimentos de cobranças"
          metrics={metrics}
          variant="basic"
          icon="💸"
          loading={loading}
        />
      </section>

      <Modal
        isOpen={mostrarFormCliente}
        onClose={limparFormCliente}
        title="Novo Cliente"
        size="md"
      >
        <form onSubmit={handleCriarCliente} className="standard-form">
          <div className="form-grid">
            <FormField label="Nome" required fullWidth>
              <input
                type="text"
                required
                value={formCliente.nome}
                onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })}
                className="form-input"
                placeholder="Nome completo"
              />
            </FormField>
            <FormField label="Telefone">
              <input
                type="text"
                value={formCliente.telefone}
                onChange={(e) => setFormCliente({ ...formCliente, telefone: e.target.value })}
                className="form-input"
                placeholder="(11) 98765-4321"
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={formCliente.email}
                onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                className="form-input"
                placeholder="exemplo@email.com"
              />
            </FormField>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={limparFormCliente}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Criar Cliente
            </button>
          </div>
        </form>
      </Modal>

      
<PageToolbar
  left={
    <input
      type="text"
      placeholder="Buscar por cliente ou descrição…"
      value={busca}
      onChange={(e) => setBusca(e.target.value)}
      className="st-input"
    />
  }
  right={
    <div className="st-chip-row">
      <button className={`st-chip ${filtroStatus === 'todos' ? 'is-active' : ''}`} onClick={() => setFiltroStatus('todos')}>Todos</button>
      <button className={`st-chip ${filtroStatus === 'pendente' ? 'is-active' : ''}`} onClick={() => setFiltroStatus('pendente')}>Pendentes</button>
      <button className={`st-chip ${filtroStatus === 'paga' ? 'is-active' : ''}`} onClick={() => setFiltroStatus('paga')}>Pagas</button>
      <button className={`st-chip ${filtroStatus === 'vencida' ? 'is-active' : ''}`} onClick={() => setFiltroStatus('vencida')}>Vencidas</button>
      <button className={`st-chip ${filtroStatus === 'cancelada' ? 'is-active' : ''}`} onClick={() => setFiltroStatus('cancelada')}>Canceladas</button>
    </div>
  }
/>

{!hasLoadedOnce.current ? (
  <div className="st-list-reserve" aria-hidden="true" />
) : loading ? (
  <SkeletonList count={8} variant="card" />
) : cobrancasFiltradas.length === 0 ? (
  <EmptyState
    icon="💸"
    title="Nenhuma cobrança encontrada"
    message="Ajuste os filtros ou crie uma nova cobrança."
    action={canCreateCob ? { label: '+ Nova cobrança', onClick: () => { limparForm(); setMostrarForm(true); } } : undefined}
  />
) : (
  <div className="cobrancas-grid">
    {cobrancasFiltradas.map(cobranca => (
        <div key={cobranca.id} className="cobranca-card">
          <div className="cobranca-header">
            <h3>{cobranca.clienteNome}</h3>
            <span className={getStatusClass(cobranca.status)}>
              {getStatusLabel(cobranca.status)}
            </span>
          </div>
          <div className="cobranca-info">
            <p><strong>Valor:</strong> {formatCurrency(cobranca.valor)}</p>
            <p><strong>Descrição:</strong> {cobranca.descricao}</p>
            <p><strong>Vencimento:</strong> {formatDate(cobranca.vencimento)}</p>
            {cobranca.formaPagamento && (
              <p><strong>Pagamento:</strong> {cobranca.formaPagamento}</p>
            )}
            {cobranca.observacoes && (
              <p><strong>Observações:</strong> {cobranca.observacoes}</p>
            )}
            <p className="cobranca-data"><strong>Criada em:</strong> {formatDate(cobranca.dataCriacao)}</p>
          </div>
          <div className="cobranca-actions">
            {(() => {
              const cliente = clientes.find(c => c.id === cobranca.clienteId);
              const telefone = cliente?.telefone;
              return telefone ? (
                <WhatsAppButton 
                  telefone={telefone} 
                  mensagem={formatarMensagemCobranca(cobranca, cobranca.status === 'paga')}
                />
              ) : null;
            })()}
            <PrintButton onPrint={() => handleImprimir(cobranca)} /><Guard 
                allowed={canEditCob}
                mode="hide"
              >
                <button
                  className="btn-icon"
                  onClick={() => handleEditar(cobranca)}
                  aria-label="Editar"
                  title="Editar cobrança"
                >
                  ✏️
                </button>
              </Guard>
              <Guard 
                allowed={canDeleteCob}
                mode="hide"
              >
                <button
                  className="btn-icon"
                  onClick={() => handleDeletar(cobranca.id)}
                  aria-label="Deletar"
                  title="Excluir cobrança"
                >
                  🗑️
                </button>
              </Guard>
          </div>
        </div>
      ))}
  </div>
)}

      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={passwordPrompt.handleClose}
        onConfirm={passwordPrompt.handleConfirm}
        title="🔐 Confirmar Exclusão de Cobrança"
        message="⚠️ Esta ação irá excluir a cobrança e criar um estorno no fluxo de caixa (se já estiver paga). Digite a senha para confirmar:"
      />
    </div>
  );
}

export default CobrancasPage;
