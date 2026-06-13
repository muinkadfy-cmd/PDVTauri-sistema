import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import PatternLock from '@/components/PatternLock';
import { OrdemServico, StatusOrdem } from '@/types';
import { getOrdensAsync, criarOrdem, atualizarOrdem, deletarOrdem, getLastOrdemError, ordenarOrdens } from '@/lib/ordens';
import { getClientes, criarCliente } from '@/lib/clientes';
import { canCreate, canEdit, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import { getCurrentSession, isAdmin } from '@/lib/auth-supabase';
import { logger } from '@/utils/logger';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import SegmentedControl from '@/components/ui/SegmentedControl';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import PrintButton from '@/components/ui/PrintButton';
import FormField from '@/components/ui/FormField';
import ClientAutocomplete from '@/components/ui/ClientAutocomplete';
import Pagination from '@/components/ui/Pagination';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import { showToast } from '@/components/ui/ToastContainer';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchBar } from '@/components/SearchBar';
import { EQUIPAMENTOS, CORES, MARCAS, DEFEITOS, ACESSORIOS, getModelosPorMarca } from '@/lib/os-presets';
import { getWarrantySettings, upsertWarrantySettings } from '@/lib/settings';
import { calcularTaxaValor, FormaPagamentoTaxa } from '@/lib/taxas-pagamento';
import { calcularDetalhesCartao } from '@/lib/taxas-pagamento';
import ResumoFinanceiro, { DadosFinanceiros } from '@/components/ResumoFinanceiro';
import { getRuntimeStoreIdOrDefault } from '@/lib/runtime-context';
import { Link } from 'react-router-dom';
import FinanceMetricsCards from '@/components/FinanceMetricsCards';
import { criarPeriodoPorTipo } from '@/lib/metrics';
import { openExternalUrlByPlatform } from '@/lib/capabilities/external-url-adapter';
import { printReceipt } from '@/services/print/receipt-service';
import './OrdensPage.css';

const DEFEITO_SEPARATOR = ' • ';
type DefeitoPreset = (typeof DEFEITOS)[number];

function isDefeitoPreset(value: string): value is DefeitoPreset {
  return (DEFEITOS as readonly string[]).includes(value);
}

function splitDefeitos(text?: string): string[] {
  return String(text || '')
    .split(/\s*(?:\n+|•|\||;|,)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinDefeitos(defeitosSelecionados: string[], defeitoAvulso: string): string {
  const tokens = [
    ...defeitosSelecionados.map((item) => item.trim()).filter(Boolean),
    ...splitDefeitos(defeitoAvulso)
  ];

  return Array.from(new Set(tokens)).join(DEFEITO_SEPARATOR);
}

function parseDefeitosFromOrdem(ordem: Pick<OrdemServico, 'defeito' | 'defeito_tipo' | 'defeito_descricao'>): {
  defeitosSelecionados: string[];
  defeitoAvulso: string;
} {
  if (ordem.defeito_tipo && ordem.defeito_tipo !== 'Outro' && !ordem.defeito_descricao) {
    return {
      defeitosSelecionados: isDefeitoPreset(ordem.defeito_tipo) ? [ordem.defeito_tipo] : [],
      defeitoAvulso: isDefeitoPreset(ordem.defeito_tipo) ? '' : ordem.defeito
    };
  }

  const base = ordem.defeito_descricao || ordem.defeito || '';
  const tokens = splitDefeitos(base);
  const defeitosSelecionados: string[] = [];
  const defeitosAvulsos: string[] = [];

  tokens.forEach((token) => {
    if (isDefeitoPreset(token)) defeitosSelecionados.push(token);
    else defeitosAvulsos.push(token);
  });

  return {
    defeitosSelecionados: Array.from(new Set(defeitosSelecionados)),
    defeitoAvulso: Array.from(new Set(defeitosAvulsos)).join(DEFEITO_SEPARATOR)
  };
}

function OrdensPage() {
  const storeId = getRuntimeStoreIdOrDefault('');
  const fixedTechEnabledKey = `smart-tech:os:fixed-tech-enabled:${storeId || 'global'}`;
  const fixedTechValueKey = `smart-tech:os:fixed-tech-value:${storeId || 'global'}`;

  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [busca, setBusca] = useState('');
  const debouncedBusca = useDebounce(busca, 250);
  const [filtroStatus, setFiltroStatus] = useState<StatusOrdem | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [ordemEditando, setOrdemEditando] = useState<OrdemServico | null>(null);
  const [clientes, setClientes] = useState(getClientes());
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [termosExpanded, setTermosExpanded] = useState(false);
  const [termosEditaveis, setTermosEditaveis] = useState('');
  const [periodoTipo, setPeriodoTipo] = useState<'hoje' | '7dias' | 'mes' | 'personalizado'>('mes');
  const [periodoCustom, setPeriodoCustom] = useState<{ inicio: string; fim: string }>({
    inicio: new Date().toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });

  const isLoadingOrdensRef = useRef(false);
  const reloadOrdensPendingRef = useRef(false);
  const reloadOrdensTimerRef = useRef<number | null>(null);

  // Técnico fixo (por loja): permite usar o mesmo responsável como padrão em novas OS
  const [fixedTechEnabled, setFixedTechEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(fixedTechEnabledKey) === '1';
    } catch {
      return false;
    }
  });

  const [fixedTechValue, setFixedTechValue] = useState<string>(() => {
    try {
      return localStorage.getItem(fixedTechValueKey) || '';
    } catch {
      return '';
    }
  });

  // Recarregar preferências se o Store ID mudar
  useEffect(() => {
    try {
      setFixedTechEnabled(localStorage.getItem(fixedTechEnabledKey) === '1');
      setFixedTechValue(localStorage.getItem(fixedTechValueKey) || '');
    } catch {
      // ignore
    }
  }, [fixedTechEnabledKey, fixedTechValueKey]);

  // Persistir preferências
  useEffect(() => {
    try {
      localStorage.setItem(fixedTechEnabledKey, fixedTechEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [fixedTechEnabled, fixedTechEnabledKey]);

  useEffect(() => {
    try {
      localStorage.setItem(fixedTechValueKey, fixedTechValue);
    } catch {
      // ignore
    }
  }, [fixedTechValue, fixedTechValueKey]);

  const [formData, setFormData] = useState({
    clienteId: '',
    clienteTelefone: '',
    equipamento: '',
    marca: '',
    modelo: '',
    cor: '',
    defeito: '',
    defeitos_selecionados: [] as string[],
    defeito_tipo: '',
    defeito_descricao: '',
    situacao: '',
    observacoes: '',
    acessorios: [] as string[],
    status: 'aberta' as StatusOrdem,
    valorServico: '',
    valorPecas: '',
    formaPagamento: 'dinheiro' as string,
    parcelas: 1,
    tecnico: '',
    dataPrevisao: '',
    senhaCliente: '',
    senhaPadrao: '',
    laudoTecnico: '',
    warranty_terms_enabled: false,
    // Garantia (meses) - 1..12
    warranty_months: 3
  });
  const [warrantyDefaults, setWarrantyDefaults] = useState<{
    loaded: boolean;
    warranty_terms: string;
    warranty_terms_enabled: boolean;
    warranty_terms_pinned: boolean;
    default_warranty_months: number;
    warranty_months_pinned: boolean;
  }>({
    loaded: false,
    warranty_terms: '',
    warranty_terms_enabled: true,
    warranty_terms_pinned: false,
    default_warranty_months: 3,
    warranty_months_pinned: false
  });
  const [formCliente, setFormCliente] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: ''
  });

  const refreshClientes = useCallback(() => {
    setClientes(getClientes());
  }, []);

  const scheduleOrdensReload = useCallback((reason: string, delay = 120) => {
    if (reloadOrdensTimerRef.current) {
      window.clearTimeout(reloadOrdensTimerRef.current);
    }
    reloadOrdensTimerRef.current = window.setTimeout(() => {
      reloadOrdensTimerRef.current = null;
      void carregarOrdens(reason);
    }, delay);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.log('[OrdensPage] Carregando ordens ao montar componente');
    }
    void carregarOrdens('mount');
    refreshClientes();
    
    // Preencher técnico (fixo por loja, se habilitado; senão usuário logado)
    const session = getCurrentSession();
    if (!ordemEditando) {
      let fixedEnabled = false;
      let fixedValue = '';
      try {
        fixedEnabled = localStorage.getItem(fixedTechEnabledKey) === '1';
        fixedValue = localStorage.getItem(fixedTechValueKey) || '';
      } catch {
        // ignore
      }

      const tech = fixedEnabled && fixedValue.trim()
        ? fixedValue.trim()
        : (session?.username || '');

      if (tech) {
        setFormData(prev => ({
          ...prev,
          tecnico: tech
        }));
      }
    }

    // Carregar defaults de termos de garantia (por loja)
    getWarrantySettings()
      .then((res) => {
        const d = res.data;
        if (res.success && d) {
          setWarrantyDefaults({
            loaded: true,
            warranty_terms: d.warranty_terms || '',
            warranty_terms_enabled: Boolean(d.warranty_terms_enabled),
            warranty_terms_pinned: Boolean(d.warranty_terms_pinned),
            default_warranty_months: Number(d.default_warranty_months || 3),
            warranty_months_pinned: Boolean(d.warranty_months_pinned)
          });
          setFormData((prev) => ({
            ...prev,
            warranty_terms_enabled: Boolean(d.warranty_terms_enabled),
            warranty_months: Boolean(d.warranty_months_pinned)
              ? Number(d.default_warranty_months || 3)
              : (prev as any).warranty_months ?? 3
          }));
        } else if (import.meta.env.DEV) {
          logger.warn('[OrdensPage] Falha ao carregar warranty settings:', res.error);
        }
      })
      .catch((e) => {
        if (import.meta.env.DEV) logger.warn('[OrdensPage] Exceção ao carregar warranty settings:', e);
      });
    
    // Sincronização automática
    const atualizarOrdens = () => {
      scheduleOrdensReload('event');
    };

    // Carregar novamente quando o SQLite ficar pronto / loja mudar / aba voltar
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshClientes();
        scheduleOrdensReload('visible', 0);
      }
    };
    const onStoreContextChanged = () => {
      refreshClientes();
      scheduleOrdensReload('store-context', 0);
    };

    // Escutar eventos de storage (outras abas)
    window.addEventListener('storage', atualizarOrdens);
    // Escutar eventos customizados (mesma aba)
    window.addEventListener('smart-tech-ordem-criada', atualizarOrdens);
    window.addEventListener('smart-tech-ordem-atualizada', atualizarOrdens);
    window.addEventListener('smart-tech-ordem-deletada', atualizarOrdens as any);
    window.addEventListener('smart-tech-backup-restored', atualizarOrdens as any);
    window.addEventListener('smarttech:sqlite-ready', onStoreContextChanged as any);
    window.addEventListener('smarttech:store-changed', onStoreContextChanged as any);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (reloadOrdensTimerRef.current) {
        window.clearTimeout(reloadOrdensTimerRef.current);
        reloadOrdensTimerRef.current = null;
      }
      window.removeEventListener('storage', atualizarOrdens);
      window.removeEventListener('smart-tech-ordem-criada', atualizarOrdens);
      window.removeEventListener('smart-tech-ordem-atualizada', atualizarOrdens);
      window.removeEventListener('smart-tech-ordem-deletada', atualizarOrdens as any);
      window.removeEventListener('smart-tech-backup-restored', atualizarOrdens as any);
      window.removeEventListener('smarttech:sqlite-ready', onStoreContextChanged as any);
      window.removeEventListener('smarttech:store-changed', onStoreContextChanged as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fixedTechEnabledKey, fixedTechValueKey, refreshClientes, scheduleOrdensReload]);

  // Recarregar termos de garantia ao abrir o formulário (Nova/Editar), para o snapshot usar o texto mais recente na impressão
  useEffect(() => {
    if (!mostrarForm) return;
    getWarrantySettings()
      .then((res) => {
        const d = res.data;
        if (res.success && d) {
          setWarrantyDefaults((prev) => ({
            ...prev,
            loaded: true,
            warranty_terms: d.warranty_terms || '',
            warranty_terms_enabled: Boolean(d.warranty_terms_enabled),
            warranty_terms_pinned: Boolean(d.warranty_terms_pinned),
            default_warranty_months: Number(d.default_warranty_months || 3),
            warranty_months_pinned: Boolean(d.warranty_months_pinned)
          }));
          // Se garantia (meses) estiver fixada, preencher o formulário automaticamente
          if (Boolean(d.warranty_months_pinned)) {
            setFormData((prev) => ({
              ...prev,
              warranty_months: Number(d.default_warranty_months || 3)
            }));
          }

          
          // Inicializar termos editáveis com o texto padrão ou snapshot da OS
          if (ordemEditando) {
            setTermosEditaveis(ordemEditando.warranty_terms_snapshot || d.warranty_terms || '');
          } else {
            // ✅ Auto-preencher termos se estiverem fixados (pinned)
            if (d.warranty_terms_pinned && d.warranty_terms) {
              setTermosEditaveis(d.warranty_terms);
            } else {
              setTermosEditaveis(d.warranty_terms || '');
            }
          }
        }
      })
      .catch(() => {});
  }, [mostrarForm, ordemEditando]);

  // Busca e ordenação com useMemo
  const ordensFiltradasEOrdenadas = useMemo(() => {
    const termo = debouncedBusca.trim().toLowerCase();
    let ordensFiltradas = termo
      ? ordens.filter((o) =>
          o.numero.toLowerCase().includes(termo) ||
          (o.numero_os || '').toLowerCase().includes(termo) ||
          o.clienteNome.toLowerCase().includes(termo) ||
          o.equipamento.toLowerCase().includes(termo) ||
          o.defeito.toLowerCase().includes(termo) ||
          (o.marca || '').toLowerCase().includes(termo) ||
          (o.modelo || '').toLowerCase().includes(termo)
        )
      : ordens;

    if (filtroStatus) {
      ordensFiltradas = ordensFiltradas.filter(o => o.status === filtroStatus);
    }

    // Ordenar decrescente
    return ordenarOrdens(ordensFiltradas);
  }, [ordens, debouncedBusca, filtroStatus]);

  // Métricas financeiras (baseadas nas ordens já carregadas do SQLite)
  const metrics = useMemo(() => {
    const periodo = criarPeriodoPorTipo(
      periodoTipo,
      periodoTipo === 'personalizado' ? new Date(periodoCustom.inicio) : undefined,
      periodoTipo === 'personalizado' ? new Date(periodoCustom.fim) : undefined
    );

    const ordensPeriodo = ordens.filter((o) => {
      const raw = o.dataAbertura || (o as any).created_at || '';
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      if (periodo.inicio && d < new Date(periodo.inicio)) return false;
      if (periodo.fim && d > new Date(periodo.fim)) return false;
      return true;
    });

    let totalBruto = 0;
    let totalDescontos = 0;
    let totalTaxas = 0;
    let totalLiquido = 0;
    let custoTotal = 0;
    let lucroBruto = 0;
    let lucroLiquido = 0;

    ordensPeriodo.forEach((o) => {
      const bruto = Number(o.total_bruto || o.valorTotal || 0);
      const desconto = Number(o.desconto || 0);
      const taxa = Number(o.taxa_cartao_valor || 0);
      const liquido = Number(o.total_liquido ?? (bruto - desconto - taxa));
      const custo = Number((o as any).custo_interno || 0);

      totalBruto += bruto;
      totalDescontos += desconto;
      totalTaxas += taxa;
      totalLiquido += liquido;
      custoTotal += custo;
      lucroBruto += Math.max(0, bruto - desconto - custo);
      lucroLiquido += Math.max(0, liquido - custo);
    });

    const totalFinal = totalBruto - totalDescontos;
    const margem = totalLiquido > 0 ? (lucroLiquido / totalLiquido) * 100 : 0;

    return {
      totalBruto,
      totalDescontos,
      totalTaxas,
      totalFinal,
      totalLiquido,
      custoTotal,
      lucroBruto,
      lucroLiquido,
      margem,
      quantidade: ordensPeriodo.length
    };
  }, [ordens, periodoTipo, periodoCustom]);

  async function carregarOrdens(reason: string = 'manual') {
    if (isLoadingOrdensRef.current) {
      reloadOrdensPendingRef.current = true;

      if (import.meta.env.DEV) {
        logger.log('[OrdensPage] Recarregamento já em andamento, enfileirando novo ciclo:', { reason });
      }
      return;
    }

    isLoadingOrdensRef.current = true;

    try {
      const ordensCarregadas = await getOrdensAsync();

      if (import.meta.env.DEV) {
        logger.log('[OrdensPage] Ordens carregadas:', {
          total: ordensCarregadas.length,
          reason
        });
      }

      setOrdens(ordensCarregadas);
    } finally {
      isLoadingOrdensRef.current = false;

      if (reloadOrdensPendingRef.current) {
        reloadOrdensPendingRef.current = false;
        window.setTimeout(() => {
          void carregarOrdens('queued');
        }, 80);
      }
    }
  }

  // Paginação
  const pagination = usePagination(ordensFiltradasEOrdenadas, { itemsPerPage: 20 });

  const limparForm = () => {
    const session = getCurrentSession();
    setFormData({
      clienteId: '',
      clienteTelefone: '',
      equipamento: '',
      marca: '',
      modelo: '',
      cor: '',
      defeito: '',
      defeitos_selecionados: [] as string[],
      defeito_tipo: '',
      defeito_descricao: '',
      situacao: '',
      observacoes: '',
      acessorios: [],
      status: 'aberta' as StatusOrdem,
      valorServico: '',
      valorPecas: '',
      formaPagamento: 'dinheiro',
      parcelas: 1,
      tecnico: (fixedTechEnabled && fixedTechValue.trim() ? fixedTechValue.trim() : (session?.username || '')),
      dataPrevisao: '',
      senhaCliente: '',
      senhaPadrao: '',
      laudoTecnico: '',
      warranty_terms_enabled: warrantyDefaults.warranty_terms_enabled,
      warranty_months: warrantyDefaults.warranty_months_pinned
        ? Number(warrantyDefaults.default_warranty_months || 3)
        : 3
    });
    setOrdemEditando(null);
    setMostrarForm(false);
    setTermosExpanded(false);
    setTermosEditaveis(warrantyDefaults.warranty_terms || '');
  };

  const limparFormCliente = () => {
    setFormCliente({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      observacoes: ''
    });
    setMostrarFormCliente(false);
  };

  const handleCriarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formCliente.nome) {
      showToast('Nome do cliente é obrigatório.', 'warning');
      return;
    }

    const novoCliente = await criarCliente({
      nome: formCliente.nome,
      email: formCliente.email || undefined,
      telefone: formCliente.telefone || undefined,
      cpf: formCliente.cpf || undefined,
      endereco: formCliente.endereco || undefined,
      cidade: formCliente.cidade || undefined,
      estado: formCliente.estado || undefined,
      cep: formCliente.cep || undefined,
      observacoes: formCliente.observacoes || undefined
    });

    if (novoCliente) {
      showToast('Cliente criado com sucesso!', 'success');
      setClientes(getClientes());
      setFormData({ ...formData, clienteId: novoCliente.id });
      limparFormCliente();
    } else {
      showToast('Erro ao criar cliente. Verifique os dados e tente novamente.', 'error');
    }
  };

  const handleCriarClienteRapido = async (nome: string) => {
    if (!nome.trim()) return;

    const novoCliente = await criarCliente({
      nome: nome.trim(),
    });

    if (novoCliente) {
      showToast('Cliente criado com sucesso!', 'success');
      setClientes(getClientes());
      setFormData({ ...formData, clienteId: novoCliente.id });
    } else {
      showToast('Erro ao criar cliente.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir double-submit
    if (isSaving) {
      if (import.meta.env.DEV) {
        logger.log('[OrdensPage] Salvamento já em andamento, ignorando submit duplicado');
      }
      return;
    }
    
    if (!formData.clienteId) {
      showToast('Selecione um cliente.', 'warning');
      return;
    }

    const cliente = clientes.find(c => c.id === formData.clienteId);
    if (!cliente) {
      showToast('Cliente não encontrado.', 'error');
      return;
    }

    // Determinar defeito final (múltiplo + avulso)
    const defeitosSelecionados = Array.from(
      new Set((formData.defeitos_selecionados || []).map((item) => item.trim()).filter(Boolean))
    );
    const defeitoAvulso = (formData.defeito_descricao || '').trim();
    const defeitoFinal = joinDefeitos(defeitosSelecionados, defeitoAvulso);

    if (!defeitoFinal) {
      showToast('Informe ao menos um defeito relatado ou um defeito avulso.', 'warning');
      return;
    }

    const includeWarrantyTerms = warrantyDefaults.warranty_terms_pinned
      ? warrantyDefaults.warranty_terms_enabled
      : Boolean(formData.warranty_terms_enabled);
    // Usar termos editáveis se disponíveis, senão usar das configurações
    const snapshot =
      includeWarrantyTerms
        ? (termosEditaveis || warrantyDefaults.warranty_terms || '').trim()
        : '';

    // Calcular valores financeiros
    const dadosFinanceiros = calcularDadosFinanceiros();
	    const isConcluida = formData.status === 'concluida';
    
    const ordemData: Omit<OrdemServico, 'id' | 'numero' | 'dataAbertura'> & { status?: StatusOrdem } = {
      clienteId: formData.clienteId,
      clienteNome: cliente.nome,
      clienteTelefone: formData.clienteTelefone || undefined,
      equipamento: formData.equipamento,
      marca: formData.marca || undefined,
      modelo: formData.modelo || undefined,
      cor: formData.cor || undefined,
      defeito: defeitoFinal,
      defeito_tipo: defeitosSelecionados.length === 1 && !defeitoAvulso ? defeitosSelecionados[0] : (defeitoFinal ? 'Outro' : undefined),
      defeito_descricao: defeitosSelecionados.length > 1 || Boolean(defeitoAvulso) ? defeitoFinal : undefined,
      situacao: formData.situacao || undefined,
      observacoes: formData.observacoes || undefined,
      acessorios: formData.acessorios, // Sempre salvar ([] = nenhum entregue, valor legal)
      status: formData.status,
      valorServico: formData.valorServico ? parseFloat(formData.valorServico) : undefined,
      valorPecas: formData.valorPecas ? parseFloat(formData.valorPecas) : undefined,
	      // Pagamento só é definido quando a OS for concluída (evita lançar no financeiro antes da hora)
	      ...(isConcluida
	        ? {
	            formaPagamento: formData.formaPagamento as any,
	            parcelas: formData.formaPagamento === 'credito' ? formData.parcelas : 1,
	            status_pagamento: 'pago' as const
	          }
	        : {}),
      // Valores calculados automaticamente
      valorTotal: dadosFinanceiros.totalBruto || undefined,
      total_bruto: dadosFinanceiros.totalBruto || undefined,
	      // Importante: manter 0 para conseguir "zerar" taxa quando o cliente troca de cartão -> pix/dinheiro
	      taxa_cartao_valor: dadosFinanceiros.taxaValor,
	      taxa_cartao_percentual: dadosFinanceiros.taxaPercentual,
      total_liquido: dadosFinanceiros.totalLiquido || undefined,
      tecnico: formData.tecnico || undefined,
      dataPrevisao: formData.dataPrevisao || undefined,
      senhaCliente: formData.senhaCliente || undefined,
      senhaPadrao: formData.senhaPadrao || undefined,
      laudoTecnico: formData.laudoTecnico || undefined,
      warranty_terms_enabled: includeWarrantyTerms,
      warranty_terms_snapshot: snapshot,
      warranty_months: Number((formData as any).warranty_months || 3)
    };
    
    setIsSaving(true);
    
    try {
      let resultado: OrdemServico | null = null;
      
      if (ordemEditando) {
        resultado = await atualizarOrdem(ordemEditando.id, ordemData);
        if (resultado) {
          showToast(`Ordem ${resultado.numero} atualizada com sucesso!`, 'success');
        } else {
          showToast(getLastOrdemError() || 'Erro ao atualizar ordem. Revise os dados e tente novamente.', 'error');
          return;
        }
      } else {
        resultado = await criarOrdem(ordemData);
        if (resultado) {
          showToast(`Ordem ${resultado.numero} criada com sucesso!`, 'success');
        } else {
          showToast(getLastOrdemError() || 'Erro ao criar ordem. Revise os dados e tente novamente.', 'error');
          return;
        }
      }
      
      await carregarOrdens(ordemEditando ? 'submit-update' : 'submit-create');
      limparForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditar = (ordem: OrdemServico) => {
    setOrdemEditando(ordem);
    
    const { defeitosSelecionados, defeitoAvulso } = parseDefeitosFromOrdem(ordem);
    
    setFormData({
      clienteId: ordem.clienteId,
      clienteTelefone: ordem.clienteTelefone || '',
      equipamento: ordem.equipamento,
      marca: ordem.marca || '',
      modelo: ordem.modelo || '',
      cor: ordem.cor || '',
      defeito: ordem.defeito,
      defeitos_selecionados: defeitosSelecionados,
      defeito_tipo: defeitosSelecionados.length === 1 && !defeitoAvulso ? defeitosSelecionados[0] : (ordem.defeito ? 'Outro' : ''),
      defeito_descricao: defeitoAvulso,
      situacao: ordem.situacao || '',
      observacoes: ordem.observacoes || '',
      acessorios: ordem.acessorios || [],
      status: ordem.status,
      valorServico: ordem.valorServico?.toString() || '',
      valorPecas: ordem.valorPecas?.toString() || '',
      formaPagamento: ordem.formaPagamento || 'dinheiro',
      parcelas: (ordem as any).parcelas || 1,
      tecnico: ordem.tecnico || '',
      dataPrevisao: ordem.dataPrevisao || '',
      senhaCliente: ordem.senhaCliente || '',
      senhaPadrao: (ordem as any).senhaPadrao || '',
      laudoTecnico: ordem.laudoTecnico || '',
      warranty_terms_enabled: Boolean(
        ordem.warranty_terms_enabled !== undefined
          ? ordem.warranty_terms_enabled
          : warrantyDefaults.warranty_terms_enabled
      ),
      warranty_months: Number((ordem as any).warranty_months || warrantyDefaults.default_warranty_months || 3)
    });
    setMostrarForm(true);
  };

  const calcularTotal = () => {
    const valorServico = parseFloat(formData.valorServico) || 0;
    const valorPecas = parseFloat(formData.valorPecas) || 0;
    return valorServico + valorPecas;
  };

  // Calcula dados financeiros completos (bruto, taxa, líquido, etc)
  const calcularDadosFinanceiros = (): DadosFinanceiros => {
    const valorServico = parseFloat(formData.valorServico) || 0;
    const valorPecas = parseFloat(formData.valorPecas) || 0;
    const totalBruto = valorServico + valorPecas;
    
    // Buscar taxa baseada na forma de pagamento
    const parcelas = formData.formaPagamento === 'credito' ? formData.parcelas : 1;
    
    let taxaPercentual = 0;
    let taxaValor = 0;
    
    if (totalBruto > 0 && formData.formaPagamento) {
      try {
        const resultado = calcularTaxaValor(
          totalBruto,
          formData.formaPagamento as FormaPagamentoTaxa,
          parcelas,
          storeId || ''
        );
        taxaPercentual = resultado.taxa_percentual;
        taxaValor = resultado.taxa_valor;
      } catch (error) {
        // Se não encontrar taxa, usa 0
        logger.warn('[OrdensPage] Erro ao calcular taxa:', error);
      }
    }
    
    const totalFinal = totalBruto; // OS não tem desconto por enquanto
    const totalLiquido = totalFinal - taxaValor;
    const custoTotal = valorPecas; // Custo é o valor das peças
    const lucroBruto = totalFinal - custoTotal;
    const lucroLiquido = totalLiquido - custoTotal;
    
    return {
      totalBruto,
      desconto: 0,
      descontoTipo: 'valor',
      totalFinal,
      taxaPercentual,
      taxaValor,
      totalLiquido,
      custoTotal,
      lucroBruto,
      lucroLiquido
    };
  };

  const passwordPrompt = usePasswordPrompt();
  
  const handleDeletar = async (id: string) => {
    // Solicitar senha antes de excluir
    passwordPrompt.requestPassword(() => executarExclusaoOrdem(id));
  };

  const executarExclusaoOrdem = async (id: string) => {
    const sucesso = await deletarOrdem(id);
    if (sucesso) {
      showToast('✅ Ordem excluída e estornada no fluxo de caixa!', 'success');
      carregarOrdens();
    } else {
      showToast('❌ Erro ao excluir ordem.', 'error');
    }
  };

  const getStatusColor = (status: StatusOrdem) => {
    switch (status) {
      case 'aberta': return '#3b82f6';
      case 'em_andamento': return '#f59e0b';
      case 'aguardando_peca': return '#ef4444';
      case 'concluida': return '#10b981';
      case 'cancelada': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: StatusOrdem) => {
    const labels: Record<StatusOrdem, string> = {
      aberta: 'Aberta',
      em_andamento: 'Em Andamento',
      aguardando_peca: 'Aguardando Peça',
      concluida: 'Concluída',
      cancelada: 'Cancelada'
    };
    return labels[status];
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatarMensagemOS = (ordem: OrdemServico): string => {
    let mensagem = `📋 *ORDEM DE SERVIÇO ${ordem.numero}*\n\n`;
    mensagem += `*Smart Tech Rolândia*\n\n`;
    mensagem += `*Cliente:* ${ordem.clienteNome}\n`;
    mensagem += `*Equipamento:* ${ordem.equipamento}\n`;
    if (ordem.marca) mensagem += `*Marca:* ${ordem.marca}\n`;
    if (ordem.modelo) mensagem += `*Modelo:* ${ordem.modelo}\n`;
    if (ordem.cor) mensagem += `*Cor:* ${ordem.cor}\n`;
    mensagem += `*Defeito:* ${ordem.defeito}\n`;
    if (ordem.situacao) mensagem += `*Situação:* ${ordem.situacao}\n`;
    if (ordem.senhaCliente) mensagem += `*Senha do Cliente:* ${ordem.senhaCliente}\n`;
    if (ordem.laudoTecnico) mensagem += `*Laudo Técnico:*\n${ordem.laudoTecnico}\n`;
    if (ordem.valorServico) mensagem += `*Valor do Serviço:* ${formatCurrency(ordem.valorServico)}\n`;
    if (ordem.valorPecas) mensagem += `*Valor das Peças:* ${formatCurrency(ordem.valorPecas)}\n`;
    if (ordem.valorTotal) mensagem += `\n*TOTAL: ${formatCurrency(ordem.valorTotal)}*\n`;
    mensagem += `\n*Status:* ${getStatusLabel(ordem.status)}\n`;
    mensagem += `*Data de Abertura:* ${formatDate(ordem.dataAbertura)}\n`;
    mensagem += `*Garantia:* ${Number((ordem as any).warranty_months || 3)} ${Number((ordem as any).warranty_months || 3) === 1 ? 'mês' : 'meses'}\n`;
    if (ordem.dataConclusao) mensagem += `*Conclusão:* ${formatDate(ordem.dataConclusao)}\n`;
    if (ordem.observacoes) mensagem += `\n*Observações:*\n${ordem.observacoes}\n`;
    mensagem += `\n_Emitido em ${new Date().toLocaleDateString('pt-BR')}_`;
    return mensagem;
  };

  /** Função mantida para uso futuro (ex.: botão Enviar OS por WhatsApp). */
  const handleEnviarOSWhatsApp = (ordem: OrdemServico) => {
    const cliente = clientes.find(c => c.id === ordem.clienteId);
    if (!cliente?.telefone) {
      showToast('Cliente não possui telefone cadastrado.', 'warning');
      return;
    }
    const mensagem = formatarMensagemOS(ordem);
    const telefoneFormatado = cliente.telefone.replace(/\D/g, '');
    const semZero = telefoneFormatado.startsWith('0') ? telefoneFormatado.slice(1) : telefoneFormatado;
    const telefoneFinal = semZero.startsWith('55') ? semZero : `55${semZero}`;
    const url = `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(mensagem)}`;
    void openExternalUrlByPlatform(url);
  };

  const handleImprimir = async (ordem: OrdemServico, compact: boolean = false) => {
    void compact;
    await printReceipt({ type: 'service-order', id: ordem.id });
  };

  const handleImprimirChecklist = async (ordem: OrdemServico, compact: boolean = false) => {
    void compact;
    await printReceipt({ type: 'service-order-checklist', id: ordem.id });
  };


  const readOnly = isReadOnlyMode();
  
  const session = getCurrentSession();
  const canCreatePerm = canCreate();
  const canEditPerm = canEdit();
  const canDeletePerm = canDelete();
  
  const canCreateOS = canCreatePerm && !readOnly;
  const canEditOS = canEditPerm && !readOnly;
  const canDeleteOS = canDeletePerm && !readOnly;

  return (
    <div className="ordens-page page-container">
      <ReadOnlyBanner />
      <PageHeader
        kicker="Pós-venda e assistência"
        title="Ordens de serviço"
        actions={
          <Guard
            allowed={canCreateOS}
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
              Nova ordem
            </button>
          </Guard>
        }
      />

<Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title={ordemEditando ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={limparForm}>
              Cancelar
            </button>
            <Guard 
              allowed={ordemEditando ? canEditOS : canCreateOS}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : ordemEditando ? 'Sem permissão para editar' : 'Sem permissão para criar'}
            >
              <button type="submit" className="btn-primary" form="os-form" disabled={readOnly}>
                {readOnly ? 'Modo leitura' : ordemEditando ? 'Salvar' : 'Criar'}
              </button>
            </Guard>
          </>
        )}
      >
        <form id="os-form" onSubmit={handleSubmit} className="standard-form">
          <div className="form-grid">
            <FormField label="Cliente" required fullWidth>
              <ClientAutocomplete
                clientes={clientes}
                value={formData.clienteId}
                onChange={(clienteId) => setFormData({ ...formData, clienteId })}
                onNewClient={!ordemEditando ? () => setMostrarFormCliente(true) : undefined}
                onQuickCreate={!ordemEditando ? handleCriarClienteRapido : undefined}
                disabled={!!ordemEditando}
                required
                placeholder="Digite o nome do cliente..."
              />
            </FormField>
            <FormField label="Celular do Cliente" fullWidth>
              <input
                type="tel"
                value={formData.clienteTelefone}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, clienteTelefone: e.target.value });
                }}
                className="form-input"
                placeholder="(00) 00000-0000"
                disabled={readOnly}
              />
            </FormField>
            <FormField label="Equipamento" required>
              <select
                required
                value={formData.equipamento}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, equipamento: e.target.value });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="">Selecione...</option>
                {EQUIPAMENTOS.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Marca do Aparelho" required>
              <input
                type="text"
                list="marcas-list"
                required
                value={formData.marca}
                onChange={(e) => {
                  if (readOnly) return;
                  const marca = e.target.value;
                  setFormData({ 
                    ...formData, 
                    marca,
                    modelo: '' // Limpar modelo quando marca mudar
                  });
                }}
                placeholder="Ex: Samsung..."
                className="form-input"
                readOnly={readOnly}
              />
              <datalist id="marcas-list">
                {MARCAS.map(marca => (
                  <option key={marca} value={marca} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Modelo do Aparelho" required>
              <input
                type="text"
                list="modelos-list"
                required
                value={formData.modelo}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, modelo: e.target.value });
                }}
                placeholder="Ex: Galaxy A23..."
                className="form-input"
                readOnly={readOnly}
              />
              <datalist id="modelos-list">
                {getModelosPorMarca(formData.marca).map(modelo => (
                  <option key={modelo} value={modelo} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Cor do Aparelho">
              <select
                value={formData.cor}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, cor: e.target.value });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="">Selecione...</option>
                {CORES.map(cor => (
                  <option key={cor} value={cor}>{cor}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Defeito Relatado" required fullWidth>
              <div className="os-defeitos-field">
                <div className="os-defeitos-hint">
                  Marque um ou mais defeitos da lista e, se precisar, adicione um defeito avulso/complemento.
                </div>
                <div className="os-defeitos-grid">
                  {DEFEITOS.map((defeito) => {
                    const checked = formData.defeitos_selecionados.includes(defeito);
                    return (
                      <label
                        key={defeito}
                        className="os-defeito-option"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={readOnly}
                          onChange={(e) => {
                            if (readOnly) return;
                            const next = e.target.checked
                              ? Array.from(new Set([...(formData.defeitos_selecionados || []), defeito]))
                              : (formData.defeitos_selecionados || []).filter((item) => item !== defeito);
                            setFormData({
                              ...formData,
                              defeitos_selecionados: next,
                              defeito_tipo: next.length === 1 && !(formData.defeito_descricao || '').trim() ? next[0] : (next.length > 0 || (formData.defeito_descricao || '').trim() ? 'Outro' : ''),
                              defeito: joinDefeitos(next, formData.defeito_descricao || '')
                            });
                          }}
                        />
                        <span>{defeito}</span>
                      </label>
                    );
                  })}
                </div>
                <textarea
                  value={formData.defeito_descricao}
                  onChange={(e) => {
                    if (readOnly) return;
                    const defeito_descricao = e.target.value;
                    setFormData({
                      ...formData,
                      defeito_descricao,
                      defeito_tipo: (formData.defeitos_selecionados || []).length === 1 && !defeito_descricao.trim()
                        ? formData.defeitos_selecionados[0]
                        : ((formData.defeitos_selecionados || []).length > 0 || defeito_descricao.trim() ? 'Outro' : ''),
                      defeito: joinDefeitos(formData.defeitos_selecionados || [], defeito_descricao)
                    });
                  }}
                  rows={3}
                  className="form-textarea"
                  placeholder="Defeito avulso ou complemento (opcional). Ex.: aparelho só liga aquecido / falha intermitente"
                  readOnly={readOnly}
                />
                <div className="os-defeitos-preview">
                  <strong>Vai sair na OS:</strong>{' '}
                  {joinDefeitos(formData.defeitos_selecionados || [], formData.defeito_descricao || '') || 'Nenhum defeito informado'}
                </div>
              </div>
            </FormField>
            <FormField label="Situação do Aparelho" fullWidth>
              <input
                type="text"
                value={formData.situacao}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, situacao: e.target.value });
                }}
                placeholder="Ex: Riscos na tela, trinca na parte traseira..."
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Senha do Cliente" fullWidth>
              <div className="senha-padrao-wrapper">
                {/* Campo de senha alfanumérica */}
                <div className="senha-padrao-field">
                  <label>Senha (letras e números)</label>
                  <input
                    type="text"
                    value={formData.senhaCliente}
                    onChange={(e) => {
                      if (readOnly) return;
                      setFormData({ ...formData, senhaCliente: e.target.value });
                    }}
                    placeholder="Digite a senha alfanumérica (ex: Abc123)"
                    className="form-input"
                    readOnly={readOnly}
                  />
                </div>
                
                {/* Pattern Lock */}
                <div className="senha-padrao-pattern-section">
                  <label>Senha Padrão (9 pontos)</label>
                  <PatternLock
                    value={formData.senhaPadrao}
                    onChange={(pattern) => {
                      if (readOnly) return;
                      setFormData({ ...formData, senhaPadrao: pattern });
                    }}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </FormField>
            <FormField label="Laudo Técnico" fullWidth>
              <textarea
                value={formData.laudoTecnico}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, laudoTecnico: e.target.value });
                }}
                rows={4}
                className="form-textarea"
                placeholder="Laudo técnico detalhado"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Garantia (1 a 12 meses)">
              <select
                value={Number((formData as any).warranty_months || 3)}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, warranty_months: Number(e.target.value) });
                }}
                className="form-input"
                disabled={readOnly || warrantyDefaults.warranty_months_pinned}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                  <option key={mes} value={mes}>
                    {mes} {mes === 1 ? 'mês' : 'meses'}
                  </option>
                ))}
              </select>
              {warrantyDefaults.warranty_months_pinned && (
                <div style={{ marginTop: '6px', fontSize: '0.85rem', opacity: 0.85 }}>
                  📌 Garantia padrão fixada nas configurações: {Number(warrantyDefaults.default_warranty_months || 3)} {Number(warrantyDefaults.default_warranty_months || 3) === 1 ? 'mês' : 'meses'}
                </div>
              )}
            </FormField>
            <FormField label="Responsável/Técnico">
              <input
                type="text"
                value={formData.tecnico}
                onChange={(e) => {
                  if (readOnly) return;
                  const tecnico = e.target.value;
                  setFormData({ ...formData, tecnico });
                  if (fixedTechEnabled) setFixedTechValue(tecnico);
                }}
                placeholder="Nome do técnico responsável"
                className="form-input"
                readOnly={readOnly}
              />
            
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fixedTechEnabled}
                    onChange={(e) => {
                      if (readOnly) return;
                      const next = e.currentTarget.checked;
                      setFixedTechEnabled(next);

                      if (next) {
                        const current = (formData.tecnico || '').trim();
                        const fallback = getCurrentSession()?.username || '';
                        const valueToFix = current || fixedTechValue.trim() || fallback;

                        setFixedTechValue(valueToFix);

                        if (valueToFix && valueToFix !== formData.tecnico) {
                          setFormData({ ...formData, tecnico: valueToFix });
                        }
                      }
                    }}
                    disabled={readOnly}
                  />
                  Fixar como padrão
                </label>

                {fixedTechEnabled && fixedTechValue.trim() ? (
                  <small style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Padrão: {fixedTechValue.trim()}
                  </small>
                ) : null}
              </div>
</FormField>
            <FormField label="Status" required>
              <select
                required
                value={formData.status}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, status: e.target.value as StatusOrdem });
                }}
                className="form-input"
                disabled={readOnly}
              >
                <option value="aberta">Aguardando Análise</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="aguardando_peca">Aguardando Peça</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </FormField>
            <FormField label="Valor da Peça (Uso Interno)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valorPecas}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, valorPecas: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
              <small style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Custo da peça (não visível ao cliente)
              </small>
            </FormField>
            <FormField label="Valor do Serviço (Total do Cliente)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valorServico}
                onChange={(e) => {
                  if (readOnly) return;
                  setFormData({ ...formData, valorServico: e.target.value });
                }}
                className="form-input"
                readOnly={readOnly}
              />
              <small style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Valor cobrado do cliente
              </small>
            </FormField>
            <FormField label="Total" fullWidth>
              <input
                type="text"
                value={formatCurrency(calcularTotal())}
                disabled
                className="form-input"
                style={{ fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'var(--bg-secondary)', fontSize: 'var(--font-size-lg)' }}
              />
            </FormField>

	            {/* ============ FORMA DE PAGAMENTO (somente quando concluída) ============ */}
	            {formData.status === 'concluida' ? (
	              <>
	                <FormField label="Forma de Pagamento">
	                  <select
	                    value={formData.formaPagamento}
	                    onChange={(e) => {
	                      if (readOnly) return;
	                      const formaPagamento = e.target.value;
	                      setFormData({
	                        ...formData,
	                        formaPagamento,
	                        // Reset parcelas se não for crédito
	                        parcelas: formaPagamento === 'credito' ? formData.parcelas : 1
	                      });
	                    }}
	                    className="form-input"
	                    disabled={readOnly}
	                  >
	                    <option value="dinheiro">💵 Dinheiro</option>
	                    <option value="pix">📱 PIX</option>
	                    <option value="debito">💳 Débito</option>
	                    <option value="credito">💳 Crédito</option>
	                    <option value="outro">➕ Outro</option>
	                  </select>
	                </FormField>

	                {/* Parcelas - mostrar apenas se for crédito */}
	                {formData.formaPagamento === 'credito' && (
	                  <FormField label="Parcelas">
	                    <select
	                      value={formData.parcelas}
	                      onChange={(e) => {
	                        if (readOnly) return;
	                        setFormData({ ...formData, parcelas: parseInt(e.target.value) });
	                      }}
	                      className="form-input"
	                      disabled={readOnly}
	                    >
	                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
	                        <option key={p} value={p}>
	                          {p}x
	                        </option>
	                      ))}
	                    </select>
	                  </FormField>
	                )}
	              </>
	            ) : (
	              <div className="os-payment-hint" style={{ gridColumn: '1 / -1' }}>
	                💡 O pagamento será definido quando a OS for <strong>Concluída</strong>.
	              </div>
	            )}

            {/* Resumo Financeiro - Mostrar se tiver valores */}
            {(parseFloat(formData.valorServico) > 0 || parseFloat(formData.valorPecas) > 0) && (
              <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                <ResumoFinanceiro dados={calcularDadosFinanceiros()} />
              </div>
            )}

            <FormField label="📦 Acessórios" fullWidth>
              {/* Texto legal obrigatório — valor probatório */}
              <p className="acessorios-instrucao">
                Marque os acessórios que o cliente entregou junto com o aparelho.
                Esta seleção será registrada no checklist da OS e tem valor de confirmação entre as partes.
              </p>
              <div className="acessorios-grid">
                {ACESSORIOS.map(acessorio => {
                  // "Outro" é tratado separadamente abaixo
                  if (acessorio === 'Outro') return null;
                  const isChecked = formData.acessorios.includes(acessorio);
                  return (
                    <label
                      key={acessorio}
                      className={`acessorio-item ${isChecked ? 'checked' : ''} ${readOnly ? 'readonly' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (readOnly) return;
                          const acessorios = e.target.checked
                            ? [...formData.acessorios, acessorio]
                            : formData.acessorios.filter(a => a !== acessorio);
                          setFormData({ ...formData, acessorios });
                        }}
                        disabled={readOnly}
                        className="acessorio-checkbox"
                        aria-label={acessorio}
                      />
                      <span className="acessorio-custom" aria-hidden="true">
                        <span className="acessorio-icon">
                          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M16.7071 5.29289C17.0976 5.68342 17.0976 6.31658 16.7071 6.70711L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L3.29289 10.7071C2.90237 10.3166 2.90237 9.68342 3.29289 9.29289C3.68342 8.90237 4.31658 8.90237 4.70711 9.29289L8 12.5858L15.2929 5.29289C15.6834 4.90237 16.3166 4.90237 16.7071 5.29289Z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      </span>
                      <span className="acessorio-label">{acessorio}</span>
                    </label>
                  );
                })}
              </div>

              {/* Campo "Outro" — texto personalizado */}
              {(() => {
                // Detectar se há item personalizado (não está na lista fixa)
                const fixedItems = ACESSORIOS.filter(a => a !== 'Outro') as string[];
                const customItems = formData.acessorios.filter(a => !fixedItems.includes(a) && a !== 'Outro');
                const outroChecked = customItems.length > 0 || formData.acessorios.includes('Outro');
                const outroTexto = customItems[0] || '';
                return (
                  <div className="acessorio-outro-wrap">
                    <label className={`acessorio-item acessorio-item--outro ${outroChecked ? 'checked' : ''} ${readOnly ? 'readonly' : ''}`}>
                      <input
                        type="checkbox"
                        checked={outroChecked}
                        onChange={(e) => {
                          if (readOnly) return;
                          if (!e.target.checked) {
                            // Remover todos os itens customizados e "Outro"
                            const fixedSelected = formData.acessorios.filter(a => fixedItems.includes(a));
                            setFormData({ ...formData, acessorios: fixedSelected });
                          } else {
                            setFormData({ ...formData, acessorios: [...formData.acessorios.filter(a => fixedItems.includes(a)), 'Outro'] });
                          }
                        }}
                        disabled={readOnly}
                        className="acessorio-checkbox"
                      />
                      <span className="acessorio-custom" aria-hidden="true">
                        <span className="acessorio-icon">
                          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.7071 5.29289C17.0976 5.68342 17.0976 6.31658 16.7071 6.70711L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L3.29289 10.7071C2.90237 10.3166 2.90237 9.68342 3.29289 9.29289C3.68342 8.90237 4.31658 8.90237 4.70711 9.29289L8 12.5858L15.2929 5.29289C15.6834 4.90237 16.3166 4.90237 16.7071 5.29289Z" fill="currentColor"/>
                          </svg>
                        </span>
                      </span>
                      <span className="acessorio-label">Outro</span>
                    </label>
                    {outroChecked && !readOnly && (
                      <input
                        type="text"
                        className="acessorio-outro-input"
                        placeholder="Descreva o acessório (ex: Smartwatch, Carregador wireless...)"
                        maxLength={80}
                        value={outroTexto}
                        onChange={(e) => {
                          const texto = e.target.value.trim();
                          const fixedSelected = formData.acessorios.filter(a => fixedItems.includes(a));
                          const novoArray = texto
                            ? [...fixedSelected, texto]
                            : [...fixedSelected, 'Outro'];
                          setFormData({ ...formData, acessorios: novoArray });
                        }}
                        autoFocus
                      />
                    )}
                    {outroChecked && readOnly && outroTexto && (
                      <span className="acessorio-outro-readonly">{outroTexto}</span>
                    )}
                  </div>
                );
              })()}

              {/* Contador de selecionados */}
              {formData.acessorios.length > 0 && (
                <p className="acessorios-contador">
                  ✅ {formData.acessorios.length} acessório{formData.acessorios.length > 1 ? 's' : ''} selecionado{formData.acessorios.length > 1 ? 's' : ''}
                </p>
              )}
            </FormField>
            <FormField label="Termos de Garantia" fullWidth>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Checkbox + Cabeçalho Colapsável */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={
                        warrantyDefaults.warranty_terms_pinned
                          ? warrantyDefaults.warranty_terms_enabled
                          : Boolean(formData.warranty_terms_enabled)
                      }
                      onChange={(e) => {
                        if (readOnly) return;
                        if (warrantyDefaults.warranty_terms_pinned) return;
                        setFormData({ ...formData, warranty_terms_enabled: e.target.checked });
                      }}
                      disabled={readOnly || warrantyDefaults.warranty_terms_pinned}
                    />
                    <span>Incluir na impressão</span>
                  </label>
                  
                  {((warrantyDefaults.warranty_terms_pinned && warrantyDefaults.warranty_terms_enabled) || formData.warranty_terms_enabled) && (
                    <button
                      type="button"
                      onClick={() => setTermosExpanded(!termosExpanded)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      disabled={readOnly}
                    >
                      <span style={{ transform: termosExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                      {termosExpanded ? 'Ocultar' : 'Ver/Editar'}
                    </button>
                  )}
                </div>

                {/* Hint */}
                <small style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: '0' }}>
                  {warrantyDefaults.warranty_terms_pinned
                    ? 'Os termos estão fixados nas configurações (não pode alterar aqui).'
                    : 'Editável. Salvo como snapshot nesta OS. Use "Restaurar padrão" para voltar ao texto das configurações.'}
                </small>

                {/* Preview Compacto (apenas primeiras 2-3 linhas) */}
                {((warrantyDefaults.warranty_terms_pinned && warrantyDefaults.warranty_terms_enabled) || formData.warranty_terms_enabled) && !termosExpanded && (() => {
                  const texto = termosEditaveis.trim();
                  if (!texto) return null;
                  const linhas = texto.split('\n');
                  const preview = linhas.slice(0, 2).join('\n');
                  const temMais = linhas.length > 2;
                  
                  return (
                    <div style={{ 
                      padding: '8px', 
                      background: 'var(--surface)', 
                      borderRadius: '6px', 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--text-secondary)', 
                      whiteSpace: 'pre-wrap',
                      border: '1px solid var(--border)'
                    }}>
                      {preview}
                      {temMais && <span style={{ color: 'var(--text-muted)' }}>...</span>}
                    </div>
                  );
                })()}

                {/* Editor Expandido */}
                {((warrantyDefaults.warranty_terms_pinned && warrantyDefaults.warranty_terms_enabled) || formData.warranty_terms_enabled) && termosExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      value={termosEditaveis}
                      onChange={(e) => {
                        if (readOnly) return;
                        setTermosEditaveis(e.target.value);
                      }}
                      rows={6}
                      className="form-textarea"
                      placeholder="Digite os termos de garantia..."
                      readOnly={readOnly}
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    />
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTermosEditaveis(warrantyDefaults.warranty_terms || '');
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text)',
                            cursor: 'pointer'
                          }}
                        >
                          ↻ Restaurar padrão
                        </button>
                        {isAdmin() && (
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmPin = window.confirm(
                                warrantyDefaults.warranty_terms_pinned
                                  ? 'Desfixar termos? As novas OS não serão preenchidas automaticamente.'
                                  : 'Fixar este texto como padrão? Novas OS serão preenchidas automaticamente com este texto.'
                              );
                              if (!confirmPin) return;
                              
                              try {
                                const res = await upsertWarrantySettings({
                                  warranty_terms: termosEditaveis,
                                  warranty_terms_pinned: !warrantyDefaults.warranty_terms_pinned,
                                  warranty_terms_enabled: true
                                });
                                if (res.success) {
                                  setWarrantyDefaults((prev) => ({
                                    ...prev,
                                    loaded: true,
                                    warranty_terms: termosEditaveis,
                                    warranty_terms_enabled: true,
                                    warranty_terms_pinned: !warrantyDefaults.warranty_terms_pinned
                                  }));
                                  showToast(
                                    warrantyDefaults.warranty_terms_pinned
                                      ? '✅ Termos desfixados'
                                      : '✅ Termos fixados! Novas OS serão preenchidas automaticamente.',
                                    'success'
                                  );
                                } else {
                                  showToast('Erro ao salvar: ' + (res.error || 'Erro desconhecido'), 'error');
                                }
                              } catch (e: any) {
                                showToast('Erro: ' + (e?.message || 'Erro desconhecido'), 'error');
                              }
                            }}
                            style={{
                              background: warrantyDefaults.warranty_terms_pinned ? 'var(--warning)' : 'var(--success)',
                              border: 'none',
                              padding: '6px 10px',
                              borderRadius: 'var(--radius)',
                              fontSize: 'var(--font-size-xs)',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            {warrantyDefaults.warranty_terms_pinned ? '📌 Desfixar' : '📍 Fixar como padrão'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormField>
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
          </div>
</form>
      </Modal>

      <Modal
        isOpen={mostrarFormCliente}
        onClose={limparFormCliente}
        title="Novo Cliente"
        size="md"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={limparFormCliente}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" form="os-cliente-form">
              Criar cliente
            </button>
          </>
        )}
      >
        <form id="os-cliente-form" onSubmit={handleCriarCliente} className="standard-form">
          <div className="form-grid">
            <FormField label="Nome" required fullWidth>
              <input
                type="text"
                required
                value={formCliente.nome}
                onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })}
                className="form-input"
                placeholder="Ex: João da Silva"
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={formCliente.email}
                onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                className="form-input"
                placeholder="Ex: joao@email.com"
              />
            </FormField>
            <FormField label="Telefone">
              <div className="input-with-action">
                <input
                  type="text"
                  value={formCliente.telefone}
                  onChange={(e) => setFormCliente({ ...formCliente, telefone: e.target.value })}
                  className="form-input"
                  placeholder="Ex: (11) 98765-4321"
                />
                {formCliente.telefone && (
                  <WhatsAppIcon telefone={formCliente.telefone} className="inline" />
                )}
              </div>
            </FormField>
            <FormField label="CPF">
              <input
                type="text"
                value={formCliente.cpf}
                onChange={(e) => setFormCliente({ ...formCliente, cpf: e.target.value })}
                className="form-input"
                placeholder="Ex: 123.456.789-00"
              />
            </FormField>
            <FormField label="Endereço" fullWidth>
              <input
                type="text"
                value={formCliente.endereco}
                onChange={(e) => setFormCliente({ ...formCliente, endereco: e.target.value })}
                className="form-input"
              />
            </FormField>
            <FormField label="Cidade">
              <input
                type="text"
                value={formCliente.cidade}
                onChange={(e) => setFormCliente({ ...formCliente, cidade: e.target.value })}
                className="form-input"
              />
            </FormField>
            <FormField label="Estado">
              <input
                type="text"
                value={formCliente.estado}
                onChange={(e) => setFormCliente({ ...formCliente, estado: e.target.value })}
                className="form-input"
                placeholder="Ex: PR"
              />
            </FormField>
            <FormField label="CEP">
              <input
                type="text"
                value={formCliente.cep}
                onChange={(e) => setFormCliente({ ...formCliente, cep: e.target.value })}
                className="form-input"
                placeholder="Ex: 86600-000"
              />
            </FormField>
            <FormField label="Observações" fullWidth>
              <textarea
                value={formCliente.observacoes}
                onChange={(e) => setFormCliente({ ...formCliente, observacoes: e.target.value })}
                rows={3}
                className="form-textarea"
                placeholder="Observações sobre o cliente (opcional)"
              />
            </FormField>
          </div>
</form>
      </Modal>

      <PageToolbar
  left={(
    <SearchBar
      placeholder="Buscar por número, cliente, equipamento, IMEI..."
      onSearch={setBusca}
    />
  )}
  right={(
    <div className="ordens-toolbar-right">
      <SegmentedControl
        ariaLabel="Filtrar status da OS"
        value={filtroStatus === null ? 'all' : filtroStatus}
        onChange={(v) => setFiltroStatus(v === 'all' ? null : (v as StatusOrdem))}
        options={[
          { value: 'all', label: 'Todas' },
          { value: 'aberta', label: 'Abertas' },
          { value: 'em_andamento', label: 'Em andamento' },
          { value: 'concluida', label: 'Concluídas' },
        ]}
      />
    </div>
  )}
  sticky
>
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
    <select
      value={periodoTipo}
      onChange={(e) => setPeriodoTipo(e.target.value as any)}
      className="form-input"
      style={{ width: 'auto' }}
    >
      <option value="hoje">Hoje</option>
      <option value="7dias">Últimos 7 dias</option>
      <option value="mes">Este mês</option>
      <option value="personalizado">Período personalizado</option>
    </select>

    {periodoTipo === 'personalizado' && (
      <>
        <input
          type="date"
          value={periodoCustom.inicio}
          onChange={(e) => setPeriodoCustom(prev => ({ ...prev, inicio: e.target.value }))}
          className="form-input"
        />
        <input
          type="date"
          value={periodoCustom.fim}
          onChange={(e) => setPeriodoCustom(prev => ({ ...prev, fim: e.target.value }))}
          className="form-input"
        />
      </>
    )}
  </div>
</PageToolbar>

<div className="ordens-list">

        {pagination.paginatedItems.length === 0 ? (
          <EmptyState
            icon="🛠️"
            title="Nenhuma OS encontrada"
            message="Ajuste os filtros/período ou crie uma nova ordem de serviço."
            actionsSlot={
              <div className="ordens-empty-actions">
                <Guard
                  allowed={canCreateOS}
                  mode="disable"
                  reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
                >
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      limparForm();
                      setMostrarForm(true);
                    }}
                  >
                    + Nova ordem
                  </button>
                </Guard>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setBusca('');
                    setFiltroStatus(null);
                    setPeriodoTipo('hoje');
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            }
          />
        ) : (
          pagination.paginatedItems.map(ordem => (
            <div key={ordem.id} className="ordem-card">
              <div className="ordem-header">
                <div>
                  <h3>
                    <Link
                      to={`/ordens?os=${encodeURIComponent(ordem.id)}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      title="Abrir ordem de serviço"
                    >
                      {ordem.number_status === 'pending' ? (
                        <>
                          <span style={{ color: '#ff9800' }}>OS Pendente</span>
                          <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                            ({ordem.numero})
                          </span>
                        </>
                      ) : (
                        <>{ordem.numero}</>
                      )}
                    </Link>
                  </h3>
                  <p className="ordem-cliente">{ordem.clienteNome}</p>
                </div>
                <div className="ordem-actions">
                  <span
                    className="status-badge"
                    style={{ backgroundColor: `${getStatusColor(ordem.status)}20`, color: getStatusColor(ordem.status) }}
                  >
                    {getStatusLabel(ordem.status)}
                  </span>
                  <div className="ordem-actions-buttons">
                    {(() => {
                      // Priorizar telefone da ordem, senão buscar do cadastro do cliente
                      const telefone = ordem.clienteTelefone || clientes.find(c => c.id === ordem.clienteId)?.telefone;
                      return telefone ? (
                        <WhatsAppButton 
                          telefone={telefone} 
                          mensagem={formatarMensagemOS(ordem)}
                        />
                      ) : null;
                    })()}
                    <PrintButton onPrint={() => handleImprimir(ordem)} /><PrintButton onPrint={() => handleImprimirChecklist(ordem)}>
                      <>
                        <span className="print-icon">☑️</span>
                        <span className="print-text">Checklist</span>
                      </>
                    </PrintButton><Guard 
                      allowed={canEditOS}
                      mode="hide"
                    >
                      <button
                        className="btn-icon"
                        onClick={() => handleEditar(ordem)}
                        aria-label="Editar"
                        title="Editar ordem"
                      >
                        ✏️
                      </button>
                    </Guard>
                    <Guard 
                      allowed={canDeleteOS}
                      mode="hide"
                    >
                      <button
                        className="btn-icon"
                        onClick={() => handleDeletar(ordem.id)}
                        aria-label="Deletar"
                        title="Excluir ordem"
                      >
                        🗑️
                      </button>
                    </Guard>
                  </div>
                </div>
              </div>
              <div className="ordem-info">
                <div className="ordem-detalhes">
                  <div className="detalhe-item">
                    <strong>Equipamento:</strong> {ordem.equipamento}
                  </div>
                  {ordem.marca && (
                    <div className="detalhe-item">
                      <strong>Marca:</strong> {ordem.marca}
                    </div>
                  )}
                  {ordem.modelo && (
                    <div className="detalhe-item">
                      <strong>Modelo:</strong> {ordem.modelo}
                    </div>
                  )}
                  {ordem.cor && (
                    <div className="detalhe-item">
                      <strong>Cor:</strong> {ordem.cor}
                    </div>
                  )}
                  <div className="detalhe-item">
                    <strong>Defeito:</strong> {ordem.defeito}
                  </div>
                  {ordem.situacao && (
                    <div className="detalhe-item">
                      <strong>Situação:</strong> {ordem.situacao}
                    </div>
                  )}
                  {ordem.senhaCliente && (
                    <div className="detalhe-item">
                      <strong>Senha do Cliente:</strong> {ordem.senhaCliente}
                    </div>
                  )}
                  {ordem.laudoTecnico && (
                    <div className="detalhe-item">
                      <strong>Laudo Técnico:</strong> {ordem.laudoTecnico}
                    </div>
                  )}
                  {ordem.observacoes && (
                    <div className="detalhe-item">
                      <strong>Observações:</strong> {ordem.observacoes}
                    </div>
                  )}
                  {ordem.tecnico && (
                    <div className="detalhe-item">
                      <strong>Técnico:</strong> {ordem.tecnico}
                    </div>
                  )}
                </div>
                <div className="ordem-valores">
                  {ordem.valorTotal && (() => {
                    const storeId = getRuntimeStoreIdOrDefault('');
                    const forma = (ordem.formaPagamento || 'dinheiro') as any;
                    const parcelas = (ordem.parcelas && ordem.parcelas > 0 ? ordem.parcelas : 1) as number;

                    const bruto = Number((ordem.total_bruto ?? ordem.valorTotal ?? 0)) || 0;
                    const taxaStored = Number((ordem.taxa_cartao_valor ?? 0)) || 0;
                    const liquido = Number((ordem.total_liquido ?? ordem.valorTotal ?? 0)) || 0;

                    const isCartao = forma === 'debito' || forma === 'credito' || forma === 'cartao';
                    const detalhes = isCartao && storeId
                      ? calcularDetalhesCartao(bruto, forma === 'cartao' ? 'credito' : forma, parcelas, storeId)
                      : null;

                    const taxaTotal = taxaStored > 0 ? taxaStored : (detalhes?.taxa_total ?? 0);
                    const jurosParcel = detalhes?.juros_parcelamento ?? 0;
                    // `taxaTotal` já inclui o custo adicional do parcelamento.
                    // Para exibir detalhado sem dupla contagem:
                    // - Taxa cartão = custo base (crédito 1x / débito)
                    // - Custo parcelado = diferença (Nx - 1x)
                    const taxaBase = jurosParcel > 0 ? Math.max(0, taxaTotal - jurosParcel) : Math.max(0, taxaTotal);

                    return (
                      <div className="os-totalBox">
                        <div className="os-totalHeader">
                          <div className="os-totalTitle">Total líquido</div>
                          <div className="os-totalValue">{formatCurrency(liquido)}</div>
                        </div>

                        {(() => {
                          const labelForma =
                            forma === 'dinheiro' ? 'Dinheiro' :
                            forma === 'pix' ? 'Pix' :
                            forma === 'debito' ? 'Cartão débito' :
                            forma === 'credito' ? 'Cartão crédito' :
                            forma === 'cartao' ? 'Cartão' :
                            forma ? String(forma) : '';

                          const labelParcelas = (forma === 'credito' && parcelas > 1) ? ` • ${parcelas}x` : '';
                          const showChip = !!labelForma;
                          return showChip ? (
                            <div className="os-payChip" title="Forma de pagamento">
                              <span className="os-payChipText">{labelForma}{labelParcelas}</span>
                            </div>
                          ) : null;
                        })()}

                        {(bruto > 0 || taxaBase > 0 || jurosParcel > 0) && (
                          <div className="os-totalDetails">
                            {bruto > 0 && (
                              <div className="os-row">
                                <span className="os-k">Bruto</span>
                                <span className="os-v">{formatCurrency(bruto)}</span>
                              </div>
                            )}

                            {taxaBase > 0 && (
                              <div className="os-row">
                                <span className="os-k">Taxa cartão</span>
                                <span className="os-v os-neg">- {formatCurrency(taxaBase)}</span>
                              </div>
                            )}

                            {jurosParcel > 0 && (
                              <div className="os-row">
                                <span className="os-k">Custo parcelado</span>
                                <span className="os-v os-neg">- {formatCurrency(jurosParcel)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ); 
})()}
                  <div className="ordem-meta">
                    <span>Abertura: {formatDate(ordem.dataAbertura)}</span>
                    {ordem.dataConclusao && (
                      <span>Conclusão: {formatDate(ordem.dataConclusao)}</span>
                    )}
                    {!!Number((ordem as any).warranty_months || 3) && (
                      <span>Garantia: {Number((ordem as any).warranty_months || 3)} {Number((ordem as any).warranty_months || 3) === 1 ? 'mês' : 'meses'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {ordens.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.goToPage}
          onNext={pagination.nextPage}
          onPrev={pagination.prevPage}
          canGoNext={pagination.canGoNext}
          canGoPrev={pagination.canGoPrev}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          totalItems={pagination.totalItems}
        />
      )}

      {/* Prompt de senha para exclusão */}
      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={passwordPrompt.handleClose}
        onConfirm={passwordPrompt.handleConfirm}
        title="🔐 Confirmar Exclusão de Ordem"
        message="⚠️ Esta ação irá excluir a ordem de serviço e criar um estorno no fluxo de caixa. Digite a senha para confirmar:"
      />
    </div>
  );
}

export default OrdensPage;
