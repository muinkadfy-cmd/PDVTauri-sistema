import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Recibo } from '@/types';

import { getRecibos, gerarRecibo, deletarRecibo } from '@/lib/recibos';
import { getClientes, criarCliente } from '@/lib/clientes';
import { canCreate, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import { getMetrics, criarPeriodoPorTipo } from '@/lib/metrics';

import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import ClientAutocomplete from '@/components/ui/ClientAutocomplete';
import PrintButton from '@/components/ui/PrintButton';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import FinanceMetricsCards from '@/components/FinanceMetricsCards';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonList from '@/components/ui/SkeletonList';

import { showToast } from '@/components/ui/ToastContainer';
import { formatCurrency, formatDate } from '@/utils/format';
import { printReceipt } from '@/services/print/receipt-service';
import { openExternalUrlByPlatform } from '@/lib/capabilities/external-url-adapter';

import './ReciboPage.css';

type PeriodoTipo = 'hoje' | '7dias' | 'mes' | 'personalizado';

const TIPOS: Array<{ value: Recibo['tipo']; label: string }> = [
  { value: 'venda', label: 'Venda' },
  { value: 'servico', label: 'Ordem de Serviço' },
  { value: 'cobranca', label: 'Cobrança' },
  { value: 'outro', label: 'Outro' }
];

const PAGAMENTOS: Array<{ value: Recibo['formaPagamento']; label: string }> = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Transferência/Outro' }
];

function ReciboPage() {
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const deferredBusca = useDeferredValue(busca);
  const loadingTimer = useRef<number | null>(null);
  const reloadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);

  const [clientes, setClientes] = useState(() => getClientes() ?? []);

  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('hoje');
  const [periodoCustom, setPeriodoCustom] = useState<{ inicio: string; fim: string }>(() => {
    const hoje = new Date().toISOString().split('T')[0];
    return { inicio: hoje, fim: hoje };
  });

  const [formData, setFormData] = useState({
    clienteId: '',
    clienteNome: '', // usado quando for "cliente avulso"
    tipo: 'venda' as Recibo['tipo'],
    valor: '',
    descricao: '',
    formaPagamento: 'dinheiro' as Recibo['formaPagamento'],
    observacoes: ''
  });

  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '', email: '' });

  const passwordPrompt = usePasswordPrompt();

  const getPagamentoLabel = (fp: Recibo['formaPagamento']) =>
    PAGAMENTOS.find(p => p.value === fp)?.label ?? fp;

  const executarExclusaoRecibo = async (id: string) => {
    if (!canDeleteRec) return;
    const ok = await deletarRecibo(id);
    if (ok) {
      showToast('✅ Recibo excluído e estornado no fluxo de caixa!', 'success');
      void carregarRecibos();
    } else {
      showToast('❌ Erro ao excluir recibo.', 'error');
    }
  };

  const solicitarExclusao = (id: string) => {
    passwordPrompt.requestPassword(() => executarExclusaoRecibo(id));
  };

  const readOnly = isReadOnlyMode();
  const canCreateRec = canCreate() && !readOnly;
  const canDeleteRec = canDelete() && !readOnly;
  const clientesById = useMemo(() => new Map((clientes ?? []).map((cliente) => [cliente.id, cliente])), [clientes]);

  const periodo = useMemo(() => {
    return criarPeriodoPorTipo(
      periodoTipo,
      periodoTipo === 'personalizado' && periodoCustom.inicio ? new Date(periodoCustom.inicio) : undefined,
      periodoTipo === 'personalizado' && periodoCustom.fim ? new Date(periodoCustom.fim) : undefined
    );
  }, [periodoTipo, periodoCustom]);

  const metrics = useMemo(() => {
    return getMetrics({
      origem: 'RECIBO',
      from: periodo.inicio ? new Date(periodo.inicio) : undefined,
      to: periodo.fim ? new Date(periodo.fim) : undefined
    });
  }, [periodo]);

  const periodoLabel = useMemo(() => {
    if (periodoTipo === 'hoje') return 'Hoje';
    if (periodoTipo === '7dias') return 'Últimos 7 dias';
    if (periodoTipo === 'mes') return 'Este mês';
    if (periodoTipo === 'personalizado') {
      if (periodoCustom.inicio && periodoCustom.fim) return `${periodoCustom.inicio} → ${periodoCustom.fim}`;
      return 'Período personalizado';
    }
    return 'Período atual';
  }, [periodoTipo, periodoCustom]);

  const carregarRecibos = useCallback(async () => {
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
      setClientes(getClientes() ?? []);
      const list = getRecibos();
      if (seq !== reloadSeq.current) return;
      setRecibos(Array.isArray(list) ? list : []);
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
    void carregarRecibos();

    const onChanged = () => void carregarRecibos();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void carregarRecibos();
    };

    window.addEventListener('storage', onChanged);
    window.addEventListener('smart-tech-recibo-criado', onChanged as any);
    window.addEventListener('smart-tech-recibo-deletado', onChanged as any);
    window.addEventListener('smart-tech-movimentacao-criada', onChanged as any);
    window.addEventListener('smart-tech-backup-restored', onChanged as any);
    window.addEventListener('smarttech:sqlite-ready', onChanged as any);
    window.addEventListener('smarttech:store-changed', onChanged as any);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      try {
        if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      } catch {}
      window.removeEventListener('storage', onChanged);
      window.removeEventListener('smart-tech-recibo-criado', onChanged as any);
      window.removeEventListener('smart-tech-recibo-deletado', onChanged as any);
      window.removeEventListener('smart-tech-movimentacao-criada', onChanged as any);
      window.removeEventListener('smart-tech-backup-restored', onChanged as any);
      window.removeEventListener('smarttech:sqlite-ready', onChanged as any);
      window.removeEventListener('smarttech:store-changed', onChanged as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarRecibos]);

  const recibosExibidos = useMemo(() => {
    let list = Array.isArray(recibos) ? [...recibos] : [];

    // Período
    if (periodo?.inicio || periodo?.fim) {
      list = list.filter(r => {
        const d = new Date(r.data);
        if (periodo.inicio && d < periodo.inicio) return false;
        if (periodo.fim && d > periodo.fim) return false;
        return true;
      });
    }

    // Busca
    const b = deferredBusca.trim().toLowerCase();
    if (b) {
      list = list.filter(r => {
        const hay = `${r.numero ?? ''} ${r.clienteNome ?? ''} ${r.descricao ?? ''}`.toLowerCase();
        return hay.includes(b);
      });
    }

    // Ordenar (mais recente primeiro)
    list.sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return list;
  }, [deferredBusca, periodo, recibos]);

  const resumoRecibos = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const totalExibido = recibosExibidos.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const hojeCount = recibosExibidos.filter((item) => {
      const data = new Date(item.data);
      data.setHours(0, 0, 0, 0);
      return data.getTime() === hoje.getTime();
    }).length;

    return {
      exibidos: recibosExibidos.length,
      totalExibido,
      ticketMedio: recibosExibidos.length ? totalExibido / recibosExibidos.length : 0,
      comCliente: recibosExibidos.filter((item) => item.clienteNome?.trim()).length,
      hoje: hojeCount,
    };
  }, [recibosExibidos]);

  const emptyStateTitle = busca.trim()
    ? 'Nenhum recibo corresponde aos filtros atuais.'
    : 'Nenhum recibo encontrado.';
  const emptyStateMessage = busca.trim()
    ? 'Refine a busca digitada ou altere o período para visualizar mais resultados.'
    : 'Gere um recibo para registrar recebimentos com mais agilidade.';

  const abrirGerarRecibo = () => {
    setClientes(getClientes() ?? []);
    setFormData({
      clienteId: '',
      clienteNome: '',
      tipo: 'venda',
      valor: '',
      descricao: '',
      formaPagamento: 'dinheiro',
      observacoes: ''
    });
    setMostrarForm(true);
  };

  const fecharGerarRecibo = () => {
    setMostrarForm(false);
  };

  const fecharCriarCliente = () => {
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

    if (!novoCliente) {
      showToast('Erro ao criar cliente.', 'error');
      return;
    }

    showToast('Cliente criado com sucesso!', 'success');
    setClientes(getClientes() ?? []);
    setFormData(prev => ({ ...prev, clienteId: novoCliente.id, clienteNome: '' }));
    fecharCriarCliente();
  };

  const handleGerarRecibo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateRec) return;

    const valorNum = Number(formData.valor);
    if (!formData.descricao?.trim()) {
      showToast('Descrição é obrigatória.', 'warning');
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      showToast('Informe um valor válido.', 'warning');
      return;
    }

    const clienteSel = (clientes ?? []).find(c => c.id === formData.clienteId);
    const nomeFinal = clienteSel?.nome?.trim() || formData.clienteNome?.trim();
    if (!nomeFinal) {
      showToast('Selecione um cliente ou informe o nome.', 'warning');
      return;
    }

    await gerarRecibo({
      clienteId: clienteSel?.id || undefined,
      clienteNome: nomeFinal,
      clienteTelefone: clienteSel?.telefone?.trim() || undefined,
      tipo: formData.tipo,
      valor: valorNum,
      descricao: formData.descricao.trim(),
      formaPagamento: formData.formaPagamento,
      observacoes: formData.observacoes?.trim() || undefined
    });

    showToast('Recibo gerado com sucesso!', 'success');
    fecharGerarRecibo();
    void carregarRecibos();
  };

  const getTipoLabel = (tipo: Recibo['tipo']) => TIPOS.find(t => t.value === tipo)?.label ?? tipo;

  const handleEnviarReciboWhatsApp = (recibo: Recibo) => {
    const cliente = (clientes ?? []).find(c => c.id === recibo.clienteId);
    const telefone = (cliente?.telefone || recibo.clienteTelefone || '').replace(/\D/g, '');
    if (!telefone) {
      showToast('Cliente não possui telefone cadastrado.', 'warning');
      return;
    }

    const msg = [
      `*Comprovante de Recibo* #${recibo.numero}`,
      '',
      `Cliente: ${recibo.clienteNome || '-'}`,
      `Tipo: ${getTipoLabel(recibo.tipo)}`,
      `Valor: ${formatCurrency(recibo.valor)}`,
      `Pagamento: ${getPagamentoLabel(recibo.formaPagamento)}`,
      `Data: ${formatDate(recibo.data)}`,
      '',
      `Descrição: ${recibo.descricao}`,
      recibo.observacoes ? `Obs: ${recibo.observacoes}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const semZero = telefone.startsWith('0') ? telefone.slice(1) : telefone;
    const telefoneFinal = semZero.startsWith('55') ? semZero : `55${semZero}`;
    const url = `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(msg)}`;
    void openExternalUrlByPlatform(url);
  };

  const handleImprimir = (recibo: Recibo, compact: boolean = false) => {
    void compact;
    void printReceipt({ type: 'receipt', id: recibo.id });
  };

  return (
    <div className="recibo-page page-container">
      <ReadOnlyBanner />

      <PageHeader
        title="Recibos"
        subtitle="Gere recibos rapidamente e envie pelo WhatsApp quando necessário."
        actions={
          <Guard
            allowed={canCreateRec}
            mode="disable"
            reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
          >
            <button className="btn-primary" onClick={abrirGerarRecibo}>
              + Gerar recibo
            </button>
          </Guard>
        }
      />

      <PageToolbar>
        <input
          type="text"
          placeholder="Buscar por número, cliente ou descrição…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="st-input recibo-toolbar-search"
        />

        <select
          value={periodoTipo}
          onChange={(e) => setPeriodoTipo(e.target.value as PeriodoTipo)}
          className="st-input recibo-toolbar-select"
        >
          <option value="hoje">Hoje</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="mes">Este mês</option>
          <option value="personalizado">Período personalizado</option>
        </select>

        {periodoTipo === 'personalizado' ? (
          <>
            <input
              type="date"
              value={periodoCustom.inicio}
              onChange={(e) => setPeriodoCustom(prev => ({ ...prev, inicio: e.target.value }))}
              className="st-input recibo-toolbar-date"
            />
            <input
              type="date"
              value={periodoCustom.fim}
              onChange={(e) => setPeriodoCustom(prev => ({ ...prev, fim: e.target.value }))}
              className="st-input recibo-toolbar-date"
            />
          </>
        ) : null}
      </PageToolbar>

      <div className="recibo-stats">
        <div className="recibo-stat-card highlight">
          <span className="recibo-stat-label">Valor no período</span>
          <strong>{formatCurrency(resumoRecibos.totalExibido)}</strong>
          <span className="recibo-stat-helper">{periodoLabel}</span>
        </div>
        <div className="recibo-stat-card">
          <span className="recibo-stat-label">Recibos exibidos</span>
          <strong>{resumoRecibos.exibidos}</strong>
          <span className="recibo-stat-helper">Busca e período aplicados.</span>
        </div>
        <div className="recibo-stat-card">
          <span className="recibo-stat-label">Ticket médio</span>
          <strong>{formatCurrency(resumoRecibos.ticketMedio)}</strong>
          <span className="recibo-stat-helper">Média dos recibos visíveis.</span>
        </div>
        <div className="recibo-stat-card">
          <span className="recibo-stat-label">Com cliente</span>
          <strong>{resumoRecibos.comCliente}</strong>
          <span className="recibo-stat-helper">{resumoRecibos.hoje} emitido(s) hoje.</span>
        </div>
      </div>

      <FinanceMetricsCards title="Recibos" metrics={metrics} variant="basic" />

      {!hasLoadedOnce.current ? (
        <div className="st-list-reserve" aria-hidden="true" />
      ) : loading ? (
        <SkeletonList count={8} variant="card" />
      ) : recibosExibidos.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={emptyStateTitle}
          message={emptyStateMessage}
          action={canCreateRec ? { label: '+ Gerar recibo', onClick: abrirGerarRecibo } : undefined}
        />
      ) : (
        <div className="recibos-grid">
          {recibosExibidos.map(recibo => {
            const cliente = recibo.clienteId ? clientesById.get(recibo.clienteId) : undefined;
            const telefone = (cliente?.telefone || recibo.clienteTelefone || '').trim();

            return (
              <div key={recibo.id} className="recibo-card">
                <div className="recibo-header">
                  <div className="recibo-title-block">
                    <h3>Recibo #{recibo.numero}</h3>
                    <div className="recibo-meta-row">
                      <span className="recibo-tipo">{getTipoLabel(recibo.tipo)}</span>
                      <span className="recibo-payment-chip">{getPagamentoLabel(recibo.formaPagamento)}</span>
                    </div>
                  </div>

                  <div className="recibo-actions-header">
                    <button
                      className="whatsapp-button"
                      onClick={() => handleEnviarReciboWhatsApp(recibo)}
                      aria-label="Enviar comprovante no WhatsApp"
                      title="Enviar comprovante no WhatsApp"
                    >
                      <span className="whatsapp-icon">💬</span>
                      <span className="whatsapp-text">Comprovante</span>
                    </button>

                    <PrintButton onPrint={() => handleImprimir(recibo)} />
                    <Guard allowed={canDeleteRec} mode="hide">
                      <button
                        className="btn-icon"
                        onClick={() => solicitarExclusao(recibo.id)}
                        aria-label="Deletar"
                        title="Excluir recibo"
                      >
                        🗑️
                      </button>
                    </Guard>
                  </div>
                </div>

                <div className="recibo-info">
                  <p className="recibo-valor">{formatCurrency(recibo.valor)}</p>
                  {recibo.clienteNome ? (
                    <p className="recibo-cliente"><strong>Cliente:</strong> {recibo.clienteNome}</p>
                  ) : (
                    <p className="recibo-cliente recibo-cliente-muted"><strong>Cliente:</strong> Avulso</p>
                  )}
                  <p className="recibo-descricao">{recibo.descricao}</p>
                  {recibo.observacoes ? (
                    <div className="recibo-observacoes">
                      <strong>Observações</strong>
                      <span>{recibo.observacoes}</span>
                    </div>
                  ) : null}
                  <div className="recibo-footer">
                    <p className="recibo-data">{formatDate(recibo.data)}</p>
                    <span className="recibo-footer-note">{telefone ? 'WhatsApp disponível' : 'Sem telefone cadastrado'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Gerar Recibo */}
      <Modal isOpen={mostrarForm} onClose={fecharGerarRecibo} title="Gerar Recibo" size="md">
        <form onSubmit={handleGerarRecibo} className="standard-form">
          <div className="form-grid">
            <FormField label="Cliente" fullWidth>
              <ClientAutocomplete
                clientes={clientes}
                value={formData.clienteId}
                onChange={(id) => setFormData(prev => ({ ...prev, clienteId: id, clienteNome: '' }))}
                onNewClient={() => setMostrarFormCliente(true)}
              />
            </FormField>

            {!formData.clienteId ? (
              <FormField label="Nome do Cliente (avulso)" required fullWidth>
                <input
                  className="st-input"
                  value={formData.clienteNome}
                  onChange={(e) => setFormData(prev => ({ ...prev, clienteNome: e.target.value }))}
                  placeholder="Ex.: João da Silva"
                />
              </FormField>
            ) : null}

            <FormField label="Tipo" required>
              <select
                className="st-input"
                value={formData.tipo}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as Recibo['tipo'] }))}
              >
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Pagamento" required>
              <select
                className="st-input"
                value={formData.formaPagamento}
                onChange={(e) => setFormData(prev => ({ ...prev, formaPagamento: e.target.value as Recibo['formaPagamento'] }))}
              >
                {PAGAMENTOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Valor (R$)" required>
              <input
                type="number"
                min={0}
                step="0.01"
                className="st-input"
                value={formData.valor}
                onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                placeholder="0,00"
              />
            </FormField>

            <FormField label="Descrição" required fullWidth>
              <textarea
                className="st-textarea"
                rows={3}
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o que está sendo recebido…"
              />
            </FormField>

            <FormField label="Observações" fullWidth>
              <textarea
                className="st-textarea"
                rows={2}
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Opcional"
              />
            </FormField>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={fecharGerarRecibo}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Gerar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Criar Cliente */}
      <Modal isOpen={mostrarFormCliente} onClose={fecharCriarCliente} title="Novo Cliente" size="sm">
        <form onSubmit={handleCriarCliente} className="standard-form">
          <div className="form-grid">
            <FormField label="Nome" required fullWidth>
              <input
                className="st-input"
                value={formCliente.nome}
                onChange={(e) => setFormCliente(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </FormField>
            <FormField label="Telefone" fullWidth>
              <input
                className="st-input"
                value={formCliente.telefone}
                onChange={(e) => setFormCliente(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </FormField>
            <FormField label="Email" fullWidth>
              <input
                type="email"
                className="st-input"
                value={formCliente.email}
                onChange={(e) => setFormCliente(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </FormField>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={fecharCriarCliente}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Criar
            </button>
          </div>
        </form>
      </Modal>

      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={passwordPrompt.handleClose}
        onConfirm={passwordPrompt.handleConfirm}
        title="🔐 Confirmar Exclusão de Recibo"
        message="⚠️ Esta ação irá excluir o recibo e criar um estorno no fluxo de caixa. Digite a senha para confirmar:"
      />
    </div>
  );
}

export default ReciboPage;
