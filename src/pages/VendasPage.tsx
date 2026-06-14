import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Venda, ItemVenda, Produto, FormaPagamento, TipoDesconto } from '@/types';
import { getVendas, criarVenda, deletarVenda, getLastVendaError, ordenarVendas } from '@/lib/vendas';
import { getProdutosAtivos } from '@/lib/produtos';
import { getClientes, criarCliente } from '@/lib/clientes';
import { getUsuario } from '@/lib/usuario';
import { getCurrentSession } from '@/lib/auth-supabase';
import { canCreate, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import { logger } from '@/utils/logger';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonList from '@/components/ui/SkeletonList';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import PrintButton from '@/components/ui/PrintButton';
import FormField from '@/components/ui/FormField';
import Pagination from '@/components/ui/Pagination';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import { showToast } from '@/components/ui/ToastContainer';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import { printReceipt } from '@/services/print/receipt-service';
import { usePagination } from '@/hooks/usePagination';
import { SearchBar } from '@/components/SearchBar';
import ClientAutocomplete from '@/components/ui/ClientAutocomplete';
import ProductAutocomplete from '@/components/ui/ProductAutocomplete';
import { getPinnedProductIds, togglePinnedProduct } from '@/lib/pinned-products';
import { APP_EVENTS } from '@/lib/app-events';
import ResumoFinanceiro, { DadosFinanceiros } from '@/components/ResumoFinanceiro';
import { calcFinanceiroCompleto, calcCustoTotalVenda } from '@/lib/finance/calc';
import { calcularTaxaValor, getIconeFormaPagamento, getNomeFormaPagamento } from '@/lib/taxas-pagamento';
import { formatVendaId } from '@/lib/format-display-id';
import { generateId } from '@/lib/storage';
import { useDebounce } from '@/hooks/useDebounce';
import './VendasPage.css';
import { calcularDetalhesCartao } from '@/lib/taxas-pagamento';
import { getRuntimeStoreIdOrDefault } from '@/lib/runtime-context';
import { hydrateUiPref, readUiPrefBoolLocal, readUiPrefLocal, readUiPrefNumberLocal, setUiPref } from '@/lib/ui-prefs';

// Parse robusto de moeda/número (aceita "R$ 1.234,56", "1234.56", "1234,56", number)
function parseMoneyBR(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const s = String(value).trim();
  if (!s) return 0;

  // Remove tudo que não for dígito, vírgula, ponto, sinal
  let cleaned = s.replace(/[^0-9,.-]/g, '');

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  // "1.234,56" -> "1234.56"
  if (hasComma && hasDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // "25,00" -> "25.00"
    cleaned = cleaned.replace(',', '.');
  }
  // Só ponto: assume decimal ".", não remove.

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function VendasPage() {
  const [vendasBase, setVendasBase] = useState<Venda[]>([]);
  const [busca, setBusca] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [quickSale, setQuickSale] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingTimer = useRef<number | null>(null);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [manualDetailsOpen, setManualDetailsOpen] = useState<Record<number, boolean>>({});
  const [pinnedIds, setPinnedIds] = useState<string[]>(getPinnedProductIds());
  const [submitting, setSubmitting] = useState(false);
  const [vendaIdAtual, setVendaIdAtual] = useState<string | null>(null); // ✅ NOVO: ID da venda atual
  const [formData, setFormData] = useState({
    clienteId: '',
    formaPagamento: 'dinheiro' as FormaPagamento,
    parcelas: 1,
    desconto: '',
    descontoTipo: 'valor' as TipoDesconto,
    observacoes: '',
    // Garantia opcional para venda (0 = sem garantia)
    warranty_months: 0,
    // Termos de garantia (texto opcional)
    warranty_terms: ''
  });
  const debouncedBusca = useDebounce(busca, 250);

  // =========================
  // Defaults fixos (Garantia / Termos) por loja (localStorage)
  // =========================
  const storeIdForDefaults = getRuntimeStoreIdOrDefault('global');
  const warrantySalePinnedKey = `smart-tech-sale-warranty-pinned:${storeIdForDefaults}`;
  const warrantySaleValueKey = `smart-tech-sale-warranty-months:${storeIdForDefaults}`;

  const warrantyTermsPinnedKey = `smart-tech-sale-warranty-terms-pinned:${storeIdForDefaults}`;
  const warrantyTermsValueKey = `smart-tech-sale-warranty-terms:${storeIdForDefaults}`;

  const [warrantySaleDefaults, setWarrantySaleDefaults] = useState<{ pinned: boolean; meses: number }>({
    pinned: false,
    meses: 0,
  });

  const [warrantyTermsDefaults, setWarrantyTermsDefaults] = useState<{ pinned: boolean; text: string }>({
    pinned: false,
    text: '',
  });

  useEffect(() => {
    const pinned = readUiPrefBoolLocal(warrantySalePinnedKey, false);
    const meses = Math.max(0, Math.min(12, readUiPrefNumberLocal(warrantySaleValueKey, 0)));
    setWarrantySaleDefaults({ pinned, meses });

    const pinnedTerms = readUiPrefBoolLocal(warrantyTermsPinnedKey, false);
    const text = readUiPrefLocal(warrantyTermsValueKey, '');
    setWarrantyTermsDefaults({ pinned: pinnedTerms, text });

    void (async () => {
      const [pinnedRaw, mesesRaw, pinnedTermsRaw, textRaw] = await Promise.all([
        hydrateUiPref(warrantySalePinnedKey),
        hydrateUiPref(warrantySaleValueKey),
        hydrateUiPref(warrantyTermsPinnedKey),
        hydrateUiPref(warrantyTermsValueKey),
      ]);

      const nextPinned = pinnedRaw === '1' || pinnedRaw === 'true';
      const nextMeses = Math.max(0, Math.min(12, Number(mesesRaw ?? 0) || 0));
      const nextPinnedTerms = pinnedTermsRaw === '1' || pinnedTermsRaw === 'true';
      const nextText = String(textRaw || '');

      setWarrantySaleDefaults({ pinned: nextPinned, meses: nextMeses });
      setWarrantyTermsDefaults({ pinned: nextPinnedTerms, text: nextText });
      setFormData((prev) => ({
        ...prev,
        warranty_months: nextPinned ? nextMeses : prev.warranty_months,
        warranty_terms: nextPinnedTerms && !prev.warranty_terms.trim() ? nextText : prev.warranty_terms,
      }));
    })();
  }, [storeIdForDefaults]);


  
  // Hook para prompt de senha
  const passwordPrompt = usePasswordPrompt();
  const [vendaParaDeletar, setVendaParaDeletar] = useState<string | null>(null);

  useEffect(() => {
    if (warrantySaleDefaults.pinned && warrantySaleDefaults.meses > 0) {
      setFormData((prev) => ({
        ...prev,
        warranty_months: prev.warranty_months > 0 ? prev.warranty_months : warrantySaleDefaults.meses
      }));
    }
  }, [warrantySaleDefaults.pinned, warrantySaleDefaults.meses]);

  useEffect(() => {
    if (warrantyTermsDefaults.pinned && warrantyTermsDefaults.text.trim()) {
      setFormData((prev) => ({
        ...prev,
        warranty_terms: prev.warranty_terms.trim() ? prev.warranty_terms : warrantyTermsDefaults.text
      }));
    }
  }, [warrantyTermsDefaults.pinned, warrantyTermsDefaults.text]);

  useEffect(() => {
  try { perfMarkOnce('screen_mounted:vendas'); } catch {}
  logger.diagnosticOnce?.('vendas-page-mount', '[VendasPage] Montou - carregamento leve (deferred)');

  setLoadError(null);

  // Produtos costuma ser pequeno o suficiente para carregar direto
  try {
    setProdutos(getProdutosAtivos());
  } catch (e) {
    const msg = (e as any)?.message || String(e);
    logger.warn('[VendasPage] Falha ao carregar produtos:', msg);
    setLoadError(`Falha ao carregar produtos: ${msg}`);
  }

  // ✅ Evita travar no mobile: carrega clientes/vendas depois do primeiro paint
  let cancelado = false;
  if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
  loadingTimer.current = window.setTimeout(() => {
    if (!cancelado) setLoading(true);
  }, 180);

  const t = setTimeout(() => {
    if (cancelado) return;

      try {
        setClientes(getClientes());

        const base = getVendas();
        setVendasBase(ordenarVendas(base));
      } catch (e) {
      const msg = (e as any)?.message || String(e);
      logger.warn('[VendasPage] Falha ao carregar clientes/vendas:', msg);
      setLoadError(`Falha ao carregar dados de vendas: ${msg}`);
    } finally {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      if (!cancelado) setDataReady(true);
      setLoading(false);

      try {
        requestAnimationFrame(() => {
          perfMarkOnce('screen_ready:vendas');
          perfMeasure('private_shell→vendas', 'private_shell', 'screen_ready:vendas');
        });
      } catch {
        // ignore
      }
    }
  }, 0);

  return () => {
    cancelado = true;
    if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    clearTimeout(t);
  };
}, []);

  useEffect(() => {
  if (!dataReady) return;

  let cancelado = false;

  const atualizarPinned = () => {
    if (cancelado) return;
    setPinnedIds(getPinnedProductIds());
  };

      const atualizarVendas = () => {
    // ✅ Evita travar: joga o trabalho pesado pro próximo tick
    setTimeout(() => {
      if (cancelado) return;

      atualizarPinned();
      setVendasBase(ordenarVendas(getVendas()));
    }, 0);
  };

  const onStorage = () => atualizarVendas();
  const onVendaCriada = () => atualizarVendas();
  const onVendaDeletada = () => atualizarVendas();
  const onBackupRestored = () => atualizarVendas();
  const onStoreContextChanged = () => atualizarVendas();
  const onPinnedChanged = () => atualizarPinned();

  // Escutar eventos de storage (outras abas)
  window.addEventListener('storage', onStorage);
  // Escutar evento customizado (mesma aba)
  window.addEventListener('smart-tech-venda-criada', onVendaCriada as any);
  window.addEventListener('smart-tech-venda-deletada', onVendaDeletada as any);
  window.addEventListener('smart-tech-backup-restored', onBackupRestored as any);
  window.addEventListener('smarttech:sqlite-ready', onStoreContextChanged as any);
  window.addEventListener('smarttech:store-changed', onStoreContextChanged as any);
  // Produtos fixados (mesma aba)
  window.addEventListener(APP_EVENTS.PINNED_PRODUCTS_CHANGED, onPinnedChanged as any);

  // Atualizar quando a aba voltar a ficar visível
  const onVisible = () => {
    if (document.visibilityState === 'visible') atualizarVendas();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    cancelado = true;
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('smart-tech-venda-criada', onVendaCriada as any);
    window.removeEventListener('smart-tech-venda-deletada', onVendaDeletada as any);
    window.removeEventListener('smart-tech-backup-restored', onBackupRestored as any);
    window.removeEventListener('smarttech:sqlite-ready', onStoreContextChanged as any);
    window.removeEventListener('smarttech:store-changed', onStoreContextChanged as any);
    window.removeEventListener(APP_EVENTS.PINNED_PRODUCTS_CHANGED, onPinnedChanged as any);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, [dataReady]);

  const vendas = useMemo(() => {
    const termo = debouncedBusca.trim().toLowerCase();
    if (!termo) return vendasBase;

    return vendasBase.filter((v) =>
      v.numero_venda?.toLowerCase().includes(termo) ||
      v.clienteNome?.toLowerCase().includes(termo) ||
      v.vendedor.toLowerCase().includes(termo) ||
      v.itens.some((item) => item.produtoNome.toLowerCase().includes(termo)) ||
      v.total.toString().includes(termo)
    );
  }, [vendasBase, debouncedBusca]);


  // Paginação
  const pagination = usePagination(vendas, { itemsPerPage: 20 });

  const limparForm = useCallback(() => {
    setItens([]);
    setVendaIdAtual(null); // ✅ Limpar ID ao cancelar
    setFormData({
      clienteId: '',
      formaPagamento: 'dinheiro',
      parcelas: 1,
      desconto: '',
      descontoTipo: 'valor',
      // Garantia/termos: respeita padrão fixo (se houver)
      warranty_months: warrantySaleDefaults.pinned ? warrantySaleDefaults.meses : 0,
      warranty_terms: warrantyTermsDefaults.pinned ? warrantyTermsDefaults.text : '',
      observacoes: ''
    });
    setMostrarForm(false);
    setQuickSale(false);
  }, []);

  const adicionarItem = useCallback(() => {
    if (produtos.length === 0) {
      showToast('Cadastre produtos antes de adicionar itens à venda.', 'warning');
      return;
    }

    const produto = produtos[0];
    const novoItem: ItemVenda = {
      produtoId: produto.id,
      produtoNome: produto.nome,
      quantidade: 1,
      precoUnitario: produto.preco,
      subtotal: produto.preco,
      isManual: false
    };

    setItens(prev => [...prev, novoItem]);
  }, [produtos]);

  // ✅ NOVO: Adicionar item manual (sem produto cadastrado)
  const adicionarItemManual = useCallback(() => {
    const novoItem: ItemVenda = {
      produtoId: undefined, // ✅ Sem produto vinculado
      produtoNome: '',
      quantidade: 1,
      precoUnitario: 0,
      subtotal: 0,
      isManual: true // ✅ Marcado como manual
    };

    setItens(prev => [...prev, novoItem]);
  }, []);

  const atualizarItem = useCallback((index: number, updates: Partial<ItemVenda>) => {
    setItens(prev => {
      const novosItens = [...prev];
      novosItens[index] = { ...novosItens[index], ...updates };
      
      if (updates.quantidade !== undefined || updates.precoUnitario !== undefined) {
        const quantidade = updates.quantidade ?? novosItens[index].quantidade;
        const precoUnitario = updates.precoUnitario ?? novosItens[index].precoUnitario;
        novosItens[index].subtotal = quantidade * precoUnitario;
        if (novosItens[index].custoUnitario !== undefined) {
          novosItens[index].custoTotal = quantidade * (novosItens[index].custoUnitario || 0);
        }
      }
      
      return novosItens;
    });
  }, []);

  const removerItem = useCallback((index: number) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleManualDetails = useCallback((index: number) => {
    setManualDetailsOpen(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const pinnedProducts = useMemo(() => {
    const map = new Map(produtos.map(p => [p.id, p]));
    return pinnedIds.map(id => map.get(id)).filter(Boolean) as Produto[];
  }, [produtos, pinnedIds]);

  const addProductQuick = useCallback((produto: Produto) => {
    setItens(prev => {
      const idx = prev.findIndex(i => i.produtoId === produto.id);
      if (idx >= 0) {
        const next = [...prev];
        const item = next[idx];
        const quantidade = (item.quantidade || 1) + 1;
        next[idx] = {
          ...item,
          quantidade,
          subtotal: quantidade * item.precoUnitario
        };
        return next;
      }
      return [
        ...prev,
        {
          produtoId: produto.id,
          produtoNome: produto.nome,
          quantidade: 1,
          precoUnitario: produto.preco,
          subtotal: produto.preco
        }
      ];
    });
  }, []);

  // Estado para taxa (sincronizado com formaPagamento/parcelas)
  const [taxaPercentual, setTaxaPercentual] = useState(0);

  // Atualizar taxa quando forma de pagamento ou parcelas mudarem
  useEffect(() => {
    try {
      const forma = formData.formaPagamento === 'boleto' ? 'outro' : formData.formaPagamento;
      const activeStoreId = getRuntimeStoreIdOrDefault('');
      const taxaInfo = calcularTaxaValor(100, forma, formData.parcelas, activeStoreId);
      setTaxaPercentual(taxaInfo.taxa_percentual);
    } catch {
      setTaxaPercentual(0);
    }
  }, [formData.formaPagamento, formData.parcelas]);

  // Memoizar cálculo financeiro completo
  const resumoFinanceiro = useMemo<DadosFinanceiros>(() => {
    if (itens.length === 0) {
      return {
        totalBruto: 0,
        desconto: 0,
        descontoTipo: formData.descontoTipo,
        totalFinal: 0,
        taxaPercentual: 0,
        taxaValor: 0,
        totalLiquido: 0,
        custoTotal: 0,
        lucroBruto: 0,
        lucroLiquido: 0
      };
    }

    const desconto = parseFloat(formData.desconto) || 0;

    const resultado = calcFinanceiroCompleto(
      itens,
      desconto,
      formData.descontoTipo,
      taxaPercentual
    );

    return {
      totalBruto: resultado.totalBruto,
      desconto: desconto,
      descontoTipo: formData.descontoTipo,
      totalFinal: resultado.totalFinal,
      taxaPercentual: taxaPercentual,
      taxaValor: resultado.taxaValor,
      totalLiquido: resultado.totalLiquido,
      custoTotal: resultado.custoTotal,
      lucroBruto: resultado.lucroBruto,
      lucroLiquido: resultado.lucroLiquido
    };
  }, [itens, formData.desconto, formData.descontoTipo, taxaPercentual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ PROTEÇÃO: Evitar clique duplo
    if (submitting) {
      logger.warn('[Vendas] Submissão já em andamento, ignorando clique duplo');
      return;
    }
    
    if (itens.length === 0) {
      showToast('❌ Adicione pelo menos um produto antes de finalizar a venda!', 'error');
      return;
    }

    // ✅ ATUALIZADO: Validar items (aceitar manuais)
    // Items manuais devem ter nome e preço
    const itemManualInvalido = itens.find(item => 
      item.isManual && (!item.produtoNome?.trim() || item.precoUnitario <= 0)
    );
    if (itemManualInvalido) {
      showToast('❌ Items manuais devem ter nome e preço válidos!', 'error');
      return;
    }

    // Items de produtos cadastrados devem ter produtoId válido
    const itemProdutoInvalido = itens.find(item => 
      !item.isManual && (!item.produtoId || !produtos.find(p => p.id === item.produtoId))
    );
    if (itemProdutoInvalido) {
      showToast('❌ Um ou mais produtos cadastrados são inválidos!', 'error');
      return;
    }

    // FIX 7: Bloquear desconto que supera o total — evita totalFinal negativo no banco
    if (resumoFinanceiro.totalFinal < 0) {
      showToast('❌ O desconto não pode ser maior que o total da venda!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const cliente = formData.clienteId ? clientes.find(c => c.id === formData.clienteId) : null;
      const vendedor = getCurrentSession()?.username || getUsuario()?.nome || 'Usuário';
      
      // Usar taxa já calculada no estado
      const taxaInfo = {
        taxa_percentual: taxaPercentual,
        taxa_valor: resumoFinanceiro.taxaValor
      };
      
      // ✅ CORREÇÃO CRÍTICA: Passar ID gerado ao abrir formulário
      const resultado = await criarVenda({
        id: vendaIdAtual || generateId(), // ✅ ID compatível (fallback p/ iOS)
        clienteId: formData.clienteId || undefined,
        clienteNome: cliente?.nome,
        clienteTelefone: cliente?.telefone,
        clienteEndereco: cliente?.endereco,
        clienteCidade: cliente?.cidade,
        clienteEstado: cliente?.estado,
        itens,
        total: resumoFinanceiro.totalBruto,
        desconto: parseFloat(formData.desconto) || undefined,
        desconto_tipo: formData.descontoTipo,
        total_final: resumoFinanceiro.totalFinal,
        taxa_cartao_percentual: taxaInfo.taxa_percentual,
        taxa_cartao_valor: taxaInfo.taxa_valor,
        total_liquido: resumoFinanceiro.totalLiquido,
        custo_total: resumoFinanceiro.custoTotal,
        lucro_bruto: resumoFinanceiro.lucroBruto,
        lucro_liquido: resumoFinanceiro.lucroLiquido,
        formaPagamento: formData.formaPagamento,
        parcelas: formData.formaPagamento === 'credito' ? formData.parcelas : 1,
        vendedor,
        warranty_months: formData.warranty_months ? formData.warranty_months : undefined,
        warranty_terms: formData.warranty_terms?.trim() || undefined,
        observacoes: formData.observacoes || undefined
      });

      if (resultado) {
        showToast(`💰 Venda de R$ ${resumoFinanceiro.totalLiquido.toFixed(2).replace('.', ',')} registrada com sucesso! Veja o comprovante na lista abaixo.`, 'success');
        // Vendas são carregadas automaticamente via useMemo
        limparForm();
      } else {
        const vendaError = getLastVendaError() || 'Erro ao registrar venda. Revise os dados e tente novamente.';
        const toastType = vendaError.toLowerCase().includes('estoque insuficiente') ? 'warning' : 'error';
        showToast(vendaError, toastType);
      }
    } catch (error: any) {
      showToast(error?.message || 'Erro inesperado ao registrar venda. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletar = async (id: string) => {
    // Solicitar senha antes de excluir
    setVendaParaDeletar(id);
    passwordPrompt.requestPassword(() => executarExclusao(id));
  };

  const executarExclusao = async (id: string) => {
    const sucesso = await deletarVenda(id);
    if (sucesso) {
      showToast('✅ Venda excluída e estornada no fluxo de caixa!', 'success');
      // Vendas são carregadas automaticamente via useMemo
    } else {
      showToast('❌ Erro ao excluir venda.', 'error');
    }
    setVendaParaDeletar(null);
  };

  const formatCurrency = useCallback((value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }, []);

    const getTotaisVenda = useCallback((venda: Venda) => {
    const anyVenda: any = venda as any;

    // Bruto: preferir soma dos itens (mais confiável)
const brutoItens = Array.isArray(anyVenda.itens)
  ? anyVenda.itens.reduce((acc: number, it: any) => {
      const qtd = Number(it?.quantidade ?? it?.qtd ?? 0) || 0;
      const preco = parseMoneyBR(it?.precoUnitario ?? it?.preco_unitario ?? it?.preco ?? 0);
      const subtotalRaw = it?.subtotal ?? it?.subTotal ?? (qtd * preco);
      const subtotal = parseMoneyBR(subtotalRaw);
      return acc + subtotal;
    }, 0)
  : 0;

const brutoBase = brutoItens > 0
  ? brutoItens
  : parseMoneyBR(anyVenda.total_bruto ?? anyVenda.totalBruto ?? anyVenda.total ?? anyVenda.valor ?? 0);


    // Desconto pode vir como number, string "0.41", "0,41" ou "R$ 0,41"
const rawDesc = anyVenda.desconto ?? anyVenda.desconto_valor ?? anyVenda.descontoValor ?? 0;
const descNum = parseMoneyBR(rawDesc);


    const descTipo = (anyVenda.descontoTipo ?? anyVenda.desconto_tipo ?? 'valor') as string;
    const desconto = descTipo.includes('perc')
      ? Math.max(0, brutoBase * (descNum / 100))
      : Math.max(0, descNum);

    // Taxa do cartão (valor absoluto)
    const taxaCartaoRaw =
      anyVenda.taxa_cartao_valor ??
      anyVenda.taxaCartaoValor ??
      anyVenda.taxa_cartao ??
      0;

    const taxaCartao = parseMoneyBR(taxaCartaoRaw);

    // Líquido: se o objeto já tiver total líquido, respeitar
    const totalLiquidoRaw = anyVenda.totalLiquido ?? anyVenda.total_liquido ?? null;
    const totalLiquidoNum = totalLiquidoRaw == null ? null : parseMoneyBR(totalLiquidoRaw);

    const liquido = totalLiquidoNum != null && !Number.isNaN(totalLiquidoNum)
      ? Math.max(0, totalLiquidoNum)
      : Math.max(0, brutoBase - desconto - taxaCartao);

    // Ajuste: se venda.total parece ser o líquido (caso comum), reconcilia
    const totalCampo = Number(anyVenda.total ?? 0) || 0;
    const totalPareceLiquido = totalCampo > 0 && Math.abs(totalCampo - liquido) < 0.01;
    const bruto = totalPareceLiquido ? brutoBase : brutoBase;

    const descontoFinal = totalCampo > 0 && totalCampo < brutoBase && desconto <= 0.0001
      ? Math.max(0, brutoBase - totalCampo)
      : desconto;

    const liquidoFinal = totalCampo > 0 && totalCampo < brutoBase && totalPareceLiquido
      ? totalCampo
      : Math.max(0, brutoBase - descontoFinal - taxaCartao);

    return { bruto, desconto: descontoFinal, liquido: liquidoFinal };
  }, []);const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  }, []);

  const handleImprimir = (venda: Venda, compact: boolean = false) => {
    void compact;
    void printReceipt({ type: 'sale', id: venda.id });
  };

  const isVendaFormDirty = mostrarForm && (
    itens.length > 0 ||
    Boolean(formData.clienteId) ||
    Boolean(formData.desconto) ||
    Boolean(formData.observacoes.trim()) ||
    Number(formData.warranty_months || 0) > 0 ||
    Boolean(formData.warranty_terms.trim()) ||
    formData.formaPagamento !== 'dinheiro' ||
    formData.parcelas !== 1
  );

  const readOnly = isReadOnlyMode();
  const canCreateVenda = canCreate() && !readOnly;
  const canDeleteVenda = canDelete() && !readOnly;
  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader kicker="Comercial" title="Vendas" subtitle="" />
        <EmptyState
          title="Não foi possível carregar Vendas"
          message={loadError}
          action={{
            label: 'Tentar novamente',
            onClick: () => window.location.reload(),
          }}
        />
      </div>
    );
  }

  return (
    <div className="vendas-page page-container">
      <ReadOnlyBanner />
      <PageHeader
        kicker="Comercial"
        title="Vendas"
        subtitle="Venda rápida, histórico e emissão de comprovantes."
        actions={
          <div className="vendas-header-actions">
            <Guard
              allowed={canCreateVenda}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
            >
              <button
                className="btn-secondary"
                onClick={() => {
                  limparForm();
                  setVendaIdAtual(generateId()); // ✅ ID compatível (fallback p/ iOS)
                  setQuickSale(true);
                  setMostrarForm(true);
                }}
              >
                Venda rápida
              </button>
            </Guard>
            <Guard
              allowed={canCreateVenda}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
            >
              <button
                className="btn-primary"
                onClick={() => {
                  limparForm();
                  setVendaIdAtual(generateId()); // ✅ ID compatível (fallback p/ iOS)
                  setMostrarForm(true);
                }}
              >
                Nova venda
              </button>
            </Guard>
          </div>
        }
      />

      <Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title={quickSale ? 'Venda rápida' : 'Nova venda'}
        size="lg"
        isDirty={isVendaFormDirty && !submitting}
        closeConfirmMessage="A venda tem dados não salvos. Deseja sair mesmo assim?"
        footer={(
          <>
            <span className="form-shortcut-hint">Ctrl+Enter salva</span>
            <button type="button" className="btn-secondary" onClick={limparForm} disabled={submitting}>
              Cancelar
            </button>
            <Guard
              allowed={canCreateVenda}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
            >
              <button type="submit" className="btn-primary" form="venda-form" disabled={submitting || readOnly}>
                {submitting ? 'Processando...' : (readOnly ? 'Modo leitura' : 'Finalizar Venda')}
              </button>
            </Guard>
          </>
        )}
      >
        <form id="venda-form" onSubmit={handleSubmit} className="standard-form vendas-form" autoComplete="off">
          <div className="form-validation-hint">Corrija os campos destacados antes de salvar.</div>
          {quickSale && (
            <div className="quick-sale-panel">
              <div className="quick-sale-header">
                <h3>Produtos Fixados</h3>
                <span className="quick-sale-subtitle">Toque para adicionar (1 unidade)</span>
              </div>
              {pinnedProducts.length === 0 ? (
                <div className="quick-sale-empty">
                  <p>Nenhum produto fixado ainda.</p>
                  <p style={{ opacity: 0.8 }}>Vá em Produtos e clique em 📌 para fixar.</p>
                </div>
              ) : (
                <div className="quick-sale-grid">
                  {pinnedProducts.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="quick-sale-item"
                      onClick={() => addProductQuick(p)}
                      disabled={readOnly}
                      title="Adicionar produto"
                    >
                      <div className="quick-sale-item-name">{p.nome}</div>
                      <div className="quick-sale-item-footer">
                        <span className="quick-sale-price">{formatCurrency(p.preco)}</span>
                        <span
                          className="quick-sale-pin"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const result = togglePinnedProduct(p.id);
                            setPinnedIds(result.ids);
                            
                            showToast(result.pinned ? '📌 Fixado' : '📌 Removido', 'success');
                          }}
                          title="Desafixar"
                          role="button"
                        >
                          📌
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-section">
            <h3>Cliente</h3>
            <FormField label="Cliente">
              <ClientAutocomplete
                clientes={clientes}
                value={formData.clienteId}
                onChange={(clienteId) => setFormData({ ...formData, clienteId })}
                onSelectCliente={(cliente) => {
                  setFormData((prev) => ({ ...prev, clienteId: cliente.id }));
                  if (cliente.telefone) showToast(`Cliente selecionado: ${cliente.nome} · ${cliente.telefone}`, 'info');
                }}
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
                placeholder="Digite o nome do cliente (opcional)..."
                autoFocus
              />
            </FormField>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Itens da Venda</h3>
              <Guard 
                allowed={canCreateVenda}
                mode="disable"
                reason={readOnly ? 'Modo leitura' : 'Sem permissão'}
              >
                <div className="venda-item-actions">
                  <button
                    type="button"
                    className="btn-add-item"
                    onClick={adicionarItem}
                    title="Adicionar produto do cadastro"
                  >
                    + Item
                  </button>
                  <button
                    type="button"
                    className="btn-add-item"
                    onClick={adicionarItemManual}
                    title="Adicionar item avulso (sem cadastro)"
                    style={{ 
                      background: 'var(--warning, #f59e0b)',
                      borderColor: 'var(--warning, #f59e0b)'
                    }}
                  >
                    Manual
                  </button>
                </div>
              </Guard>
            </div>
            
            {itens.length === 0 ? (
              <p className="empty-items">Nenhum item adicionado</p>
            ) : (
              <div className="itens-list">
                {itens.map((item, index) => (
                  <div key={index} className="item-wrap">
                  <div className="item-row">
                    <div className="item-produto">
                      {item.isManual ? (
                        // ✅ ITEM MANUAL: Input de texto livre
                        <div className="manual-item-field">
                          <input
                                                    type="text"
                                                    value={item.produtoNome}
                                                    onChange={(e) => {
                                                      if (readOnly) return;
                                                      atualizarItem(index, { produtoNome: e.target.value });
                                                    }}
                                                    className="form-input"
                                                    placeholder="Ex: iPhone 13 - Branco"
                                                    readOnly={readOnly}
                                                    style={{ 
                                                      borderLeft: '3px solid var(--warning, #f59e0b)',
                                                      fontStyle: 'italic'
                                                    }}
                                                    title="Item manual (não desconta estoque)"
                                                    autoComplete="off"
                                                  />
                          <button
                            type="button"
                            className="manual-details-toggle"
                            onClick={() => toggleManualDetails(index)}
                          >
                            {manualDetailsOpen[index] ? 'Ocultar detalhes' : 'Detalhes (modelo/cor/IMEI)'}
                          </button>
                        </div>
                      ) : (
                        // ✅ ITEM CADASTRADO: busca rápida por nome, código, categoria ou ID
                        <ProductAutocomplete
                          produtos={produtos}
                          value={item.produtoId || ''}
                          disabled={readOnly}
                          placeholder="Buscar produto por nome, código, categoria..."
                          autoFocus={index === 0 && !formData.clienteId}
                          onChange={(produtoSelecionado) => {
                            if (readOnly) return;
                            const custo = produtoSelecionado.custo_unitario ?? produtoSelecionado.custo ?? 0;
                            atualizarItem(index, {
                              produtoId: produtoSelecionado.id,
                              produtoNome: produtoSelecionado.nome,
                              precoUnitario: produtoSelecionado.preco,
                              subtotal: item.quantidade * produtoSelecionado.preco,
                              custoUnitario: custo,
                              custoTotal: item.quantidade * custo,
                            });
                          }}
                        />
                      )}
                    </div>
                    <div className="item-quantidade">
                      <input
                        type="number"
                        min="1"
                        required
                        inputMode="numeric"
                        value={item.quantidade}
                        onChange={(e) => {
                          if (readOnly) return;
                          atualizarItem(index, { quantidade: parseInt(e.target.value) || 1 });
                        }}
                        className="form-input"
                        readOnly={readOnly}
                      />
                    </div>
                    <div className="item-preco">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        inputMode="decimal"
                        value={item.precoUnitario}
                        onChange={(e) => {
                          if (readOnly) return;
                          atualizarItem(index, { precoUnitario: parseFloat(e.target.value) || 0 });
                        }}
                        className="form-input"
                        readOnly={readOnly}
                      />
                    </div>
                    <div className="item-subtotal">
                      {formatCurrency(item.subtotal)}
                    </div>
                    <Guard 
                      allowed={canCreateVenda}
                      mode="hide"
                    >
                      <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => removerItem(index)}
                      >
                        ×
                      </button>
                    </Guard>
                  </div>
                  {item.isManual && manualDetailsOpen[index] && (
                    <div className="item-manual-details">
                      <div className="manual-grid">
                        <div>
                          <label className="manual-label">Modelo</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: iPhone 13"
                            value={item.manual_modelo || ''}
                            onChange={(e) => {
                              if (readOnly) return;
                              atualizarItem(index, { manual_modelo: e.target.value });
                            }}
                            readOnly={readOnly}
                            autoComplete="off"
                          />
                        </div>

                        <div>
                          <label className="manual-label">Cor</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: Branco"
                            value={item.manual_cor || ''}
                            onChange={(e) => {
                              if (readOnly) return;
                              atualizarItem(index, { manual_cor: e.target.value });
                            }}
                            readOnly={readOnly}
                            autoComplete="off"
                          />
                        </div>

                        <div>
                          <label className="manual-label">IMEI</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Opcional"
                            value={item.manual_imei || ''}
                            onChange={(e) => {
                              if (readOnly) return;
                              atualizarItem(index, { manual_imei: e.target.value });
                            }}
                            readOnly={readOnly}
                          />
                        </div>

                        <div className="manual-grid-full">
                          <label className="manual-label">Descrição</label>
                          <textarea
                            className="form-input manual-textarea"
                            placeholder="Opcional (detalhes extras para imprimir no comprovante)"
                            value={item.manual_descricao || ''}
                            onChange={(e) => {
                              if (readOnly) return;
                              atualizarItem(index, { manual_descricao: e.target.value });
                            }}
                            readOnly={readOnly}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-section">
            <h3>Pagamento</h3>
            <div className="pagamento-grid">
              <FormField label="Forma de Pagamento" required>
                <select
                  required
                  value={formData.formaPagamento}
                  onChange={(e) => {
                    const novaForma = e.target.value as FormaPagamento;
                    setFormData({ 
                      ...formData, 
                      formaPagamento: novaForma,
                      parcelas: novaForma === 'credito' ? formData.parcelas : 1
                    });
                  }}
                  className="form-input"
                  disabled={readOnly}
                >
                  <option value="dinheiro">{getIconeFormaPagamento('dinheiro')} Dinheiro</option>
                  <option value="pix">{getIconeFormaPagamento('pix')} PIX</option>
                  <option value="debito">{getIconeFormaPagamento('debito')} Débito</option>
                  <option value="credito">{getIconeFormaPagamento('credito')} Cartão Crédito</option>
                  <option value="outro">{getIconeFormaPagamento('outro')} Outro</option>
                </select>
              </FormField>

              {formData.formaPagamento === 'credito' && (
                <FormField label="Parcelas" required>
                  <select
                    required
                    value={formData.parcelas}
                    onChange={(e) => setFormData({ ...formData, parcelas: parseInt(e.target.value) })}
                    className="form-input"
                    disabled={readOnly}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Garantia e termos" fullWidth>
                <div className="sale-warranty-card">
                  <div className="sale-warranty-head">
                    <strong>Garantia (meses)</strong>
                    <small className="muted">Aparece no comprovante da venda.</small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <select
                      value={(formData as any).warranty_months ?? 0}
                      onChange={(e) => setFormData((prev) => ({ ...prev, warranty_months: Number(e.target.value) }))}
                      disabled={warrantySaleDefaults.pinned}
                      className="form-input"
                      style={{ maxWidth: 240, minHeight: 42 }}
                    >
                      <option value={0}>Sem garantia</option>
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = i + 1;
                        return (
                          <option key={m} value={m}>
                            {m} mês{m === 1 ? '' : 'es'}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const newPinned = !warrantySaleDefaults.pinned;
                        const meses = Number((formData as any).warranty_months || 0);
                        void setUiPref(warrantySalePinnedKey, newPinned ? '1' : '0');
                        void setUiPref(warrantySaleValueKey, String(meses || 0));
                        setWarrantySaleDefaults({ pinned: newPinned, meses: meses || 0 });
                      }}
                      title={warrantySaleDefaults.pinned ? 'Desfixar garantia padrão' : 'Fixar garantia padrão'}
                    >
                      {warrantySaleDefaults.pinned ? 'Desfixar' : 'Fixar'}
                    </button>

                    {warrantySaleDefaults.pinned && (
                      <small className="muted">Padrão: {warrantySaleDefaults.meses || 0} mês(es)</small>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <strong>Termos de garantia</strong>
                    <small className="muted">Sai impresso no comprovante. Use para regras de garantia e troca.</small>
                  </div>

                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Ex: Garantia cobre defeitos de fabricação. Não cobre quedas, líquido ou mau uso."
                    value={formData.warranty_terms}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        warranty_terms: e.target.value,
                      }))
                    }
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                      marginTop: 2,
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        try {
                          if (warrantyTermsDefaults.pinned) {
                            void setUiPref(warrantyTermsPinnedKey, null);
                            setWarrantyTermsDefaults({ pinned: false, text: '' });
                          } else {
                            const text = (formData.warranty_terms || '').trim();
                            void setUiPref(warrantyTermsPinnedKey, '1');
                            void setUiPref(warrantyTermsValueKey, text);
                            setWarrantyTermsDefaults({ pinned: true, text });
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      title={
                        warrantyTermsDefaults.pinned
                          ? 'Desfixar termos de garantia'
                          : 'Fixar termos de garantia como padrão'
                      }
                    >
                      {warrantyTermsDefaults.pinned ? 'Desfixar' : 'Fixar'}
                    </button>

                    {warrantyTermsDefaults.pinned ? (
                      <small className="muted">Padrão fixo</small>
                    ) : null}
                  </div>
                </div>
              </FormField>

            </div>
          </div>

          <div className="form-section">
            <h3>Desconto</h3>
            <div className="desconto-grid">
              <FormField label="">
                <div className="desconto-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${formData.descontoTipo === 'valor' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, descontoTipo: 'valor', desconto: '' })}
                    disabled={readOnly}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${formData.descontoTipo === 'percentual' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, descontoTipo: 'percentual', desconto: '' })}
                    disabled={readOnly}
                  >
                    %
                  </button>
                </div>
              </FormField>

              <FormField label={`Valor do Desconto ${formData.descontoTipo === 'percentual' ? '(%)' : '(R$)'}`}>
                <input
                  type="number"
                  step={formData.descontoTipo === 'percentual' ? '0.1' : '0.01'}
                  min="0"
                  max={formData.descontoTipo === 'percentual' ? '100' : undefined}
                  value={formData.desconto}
                  onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                  className="form-input"
                  placeholder={formData.descontoTipo === 'percentual' ? '0.00' : '0,00'}
                  readOnly={readOnly}
                />
              </FormField>
            </div>
          </div>

          {itens.length > 0 && (
            <ResumoFinanceiro dados={resumoFinanceiro} />
          )}

          <div className="form-section">
            <FormField label="Observações" fullWidth>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                className="form-textarea"
                placeholder="Observações sobre a venda..."
                readOnly={readOnly}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      <PageToolbar
        sticky={false}
        left={(
          <SearchBar
            className="vendas-search"
            placeholder="Buscar por número, cliente, vendedor, produto..."
            onSearch={setBusca}
          />
        )}
        right={(
          <div className="vendas-toolbar-meta">
            <span>{pagination.totalItems} venda{pagination.totalItems === 1 ? '' : 's'}</span>
          </div>
        )}
      />

      <div className="vendas-list">
        {!dataReady ? (
          <div className="st-list-reserve" aria-hidden="true" />
        ) : loading ? (
          <SkeletonList count={6} variant="card" />
        ) : pagination.paginatedItems.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="Nenhuma venda encontrada"
            message="Crie uma nova venda ou ajuste os filtros de período/pesquisa."
            actionsSlot={
              <div className="vendas-empty-actions">
                <Guard
                  allowed={canCreateVenda}
                  mode="disable"
                  reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
                >
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      limparForm();
                      setVendaIdAtual(generateId()); // ✅ ID compatível (fallback p/ iOS)
                      setMostrarForm(true);
                    }}
                  >
                    + Nova venda
                  </button>
                </Guard>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setBusca('')}
                >
                  Limpar busca
                </button>
              </div>
            }
          />
        ) : (
          pagination.paginatedItems.map(venda => (
            <div key={venda.id} className="venda-card">
              <div className="venda-header">
                <div>
                  <h3>{venda.numero_venda ? `V-${venda.numero_venda}` : formatVendaId(venda.id)}</h3>
                  {venda.clienteNome && (
                    <p className="venda-cliente">Cliente: {venda.clienteNome}</p>
                  )}
                </div>
                <div className="venda-actions">
                  {(() => {
                    const cliente = venda.clienteId ? clientes.find(c => c.id === venda.clienteId) : null;
                    const telefone = venda.clienteTelefone ?? cliente?.telefone;
                    return telefone ? (
                      <WhatsAppButton 
                        telefone={telefone} 
                        mensagem={`Olá! Sobre a venda ${(venda.numero_venda ? `V-${venda.numero_venda}` : formatVendaId(venda.id))} - Total: ${formatCurrency(venda.total)} - Pagamento: ${venda.formaPagamento}`}
                      />
                    ) : null;
                  })()}
                  <PrintButton onPrint={() => handleImprimir(venda)} /><Guard 
                    allowed={canDeleteVenda}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleDeletar(venda.id)}
                      aria-label="Deletar"
                      title="Excluir venda"
                    >
                      🗑️
                    </button>
                  </Guard>
                </div>
              </div>
              <div className="venda-info">
                <div className="venda-itens">
                  <strong>Itens:</strong>
                  <ul>
                    {venda.itens.map((item, index) => (
                      <li key={index}>
                        {item.quantidade}x {item.produtoNome} - {formatCurrency(item.subtotal)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="venda-totais">
                  {(() => {
                    const { bruto, desconto, liquido } = getTotaisVenda(venda);
                    const temDesconto = desconto > 0.0001;

                    const storeId = getRuntimeStoreIdOrDefault('');
                    const forma = (venda.formaPagamento || 'dinheiro') as any;
                    const parcelas = Number((venda as any).parcelas ?? 1) || 1;

                    const isCartao = forma === 'debito' || forma === 'credito' || forma === 'cartao';
                    const detalhes = isCartao && storeId
                      ? calcularDetalhesCartao(bruto, forma === 'cartao' ? 'credito' : forma, parcelas, storeId)
                      : null;

                    const taxaStored = parseMoneyBR((venda as any).taxa_cartao_valor ?? (venda as any).taxaCartaoValor ?? 0);
                    const taxaTotal = taxaStored > 0 ? taxaStored : parseMoneyBR(detalhes?.taxa_total ?? 0);
                    const jurosParcel = parseMoneyBR(detalhes?.juros_parcelamento ?? (detalhes as any)?.juros_parcelas ?? 0);
                    // `taxaTotal` já pode incluir o custo adicional do parcelamento.
                    // Para exibir detalhado sem dupla contagem:
                    const taxaBase = jurosParcel > 0 ? Math.max(0, taxaTotal - jurosParcel) : Math.max(0, taxaTotal);


                    const totalLiquidoStoredRaw = (venda as any).total_liquido ?? (venda as any).totalLiquido ?? null;
                    const totalLiquidoStored = totalLiquidoStoredRaw == null ? 0 : parseMoneyBR(totalLiquidoStoredRaw);
                    const liquidoCard = totalLiquidoStored > 0
                      ? totalLiquidoStored
                      : Math.max(0, bruto - desconto - taxaBase - jurosParcel);

                    return (
                      <>
                        {(temDesconto || (isCartao && taxaTotal > 0)) && (
                          <div className="venda-row">
                            <span>Total Bruto:</span>
                            <span>{formatCurrency(bruto)}</span>
                          </div>
                        )}

                        {temDesconto && (
                          <div className="venda-row desconto">
                            <span>Desconto:</span>
                            <span>- {formatCurrency(desconto)}</span>
                          </div>
                        )}

                        {isCartao && taxaTotal > 0 && (
                          <div className="venda-row desconto">
                            <span>Taxa cartão:</span>
                            <span>- {formatCurrency(taxaBase)}</span>
                          </div>
                        )}

                        {forma === 'credito' && parcelas > 1 && (
                          <div className="venda-row">
                            <span>Parcelas:</span>
                            <span>{parcelas}x</span>
                          </div>
                        )}

                        {forma === 'credito' && parcelas > 1 && jurosParcel > 0 && (
                          <div className="venda-row desconto">
                            <span>Juros (parcelas):</span>
                            <span>- {formatCurrency(jurosParcel)}</span>
                          </div>
                        )}

                        <div className="venda-row total">
                          <span>{(temDesconto || (isCartao && taxaTotal > 0)) ? 'Total Líquido:' : 'Total:'}</span>
                          <span>{formatCurrency((temDesconto || (isCartao && taxaTotal > 0)) ? liquidoCard : bruto)}</span>
                        </div>
                      </>
                    );
                  })()}

                  <div className="venda-meta">
                    <span className="venda-pagamento">{venda.formaPagamento}</span>
                    <span className="venda-data">{formatDate(venda.data)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {vendas.length > 0 && (
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
        title="🔐 Confirmar Exclusão de Venda"
        message="⚠️ Esta ação irá excluir a venda e criar um estorno no fluxo de caixa. Digite a senha para confirmar:"
      />
    </div>
  );
}

export default VendasPage;
