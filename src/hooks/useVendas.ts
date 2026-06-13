/**
 * useVendas — Hook de negócio para Vendas (P2 — God Component refactoring)
 *
 * Extrai toda lógica de estado e operações de VendasPage.tsx.
 * A page fica responsável apenas por renderização.
 *
 * Benefícios:
 *  - Testável unitariamente (sem montar DOM)
 *  - Reutilizável em outros pontos da UI (ex: modal de venda rápida)
 *  - Re-renders controlados por estado memoizado
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { Venda, Produto } from '@/types';
import { getVendas, criarVenda } from '@/lib/vendas';
import { getProdutosAtivos } from '@/lib/produtos';
import { calcTotalBrutoVenda, calcTotalFinal } from '@/lib/finance/calc';
import { showToast } from '@/components/ui/ToastContainer';
import { getCurrentSession } from '@/lib/auth-supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ItemVenda {
  id: string;
  produtoId?: string;
  isManual?: boolean;
  descricao: string;
  quantidade: number;
  preco: number;
}

export interface FormVenda {
  itens: ItemVenda[];
  clienteId: string;
  formaPagamento: string;
  desconto: number;
  desconto_tipo: 'valor' | 'percentual';
  observacoes: string;
  parcelas: number;
  taxa_cartao_percentual: number;
}

const FORM_INICIAL: FormVenda = {
  itens: [],
  clienteId: '',
  formaPagamento: 'dinheiro',
  desconto: 0,
  desconto_tipo: 'valor',
  observacoes: '',
  parcelas: 1,
  taxa_cartao_percentual: 0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useVendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [form, setForm] = useState<FormVenda>(FORM_INICIAL);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Load inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    setVendas(getVendas());
    setProdutos(getProdutosAtivos());
    setLoading(false);

    const onUpdate = () => {
      setVendas(getVendas());
      setProdutos(getProdutosAtivos());
    };
    window.addEventListener('smart-tech-venda-criada', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('smart-tech-venda-criada', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  // ── Produtos mapeados ─────────────────────────────────────────────────────
  const produtosMap = useMemo(
    () => new Map(produtos.map(p => [p.id, p])),
    [produtos]
  );

  // ── Totais calculados ─────────────────────────────────────────────────────
  const totais = useMemo(() => {
    const totalBruto = calcTotalBrutoVenda(
      form.itens.map(i => ({
        produtoId: i.produtoId,
        isManual: i.isManual,
        produtoNome: i.descricao,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco: i.preco,
        precoUnitario: i.preco,
        subtotal: i.quantidade * i.preco,
        custo: 0,
      }))
    );
    const totalFinal = calcTotalFinal(totalBruto, form.desconto, form.desconto_tipo);
    return { totalBruto, totalFinal };
  }, [form.itens, form.desconto, form.desconto_tipo]);

  // ── Filtro de vendas ──────────────────────────────────────────────────────
  const vendasFiltradas = useMemo(() => {
    if (!busca.trim()) return vendas;
    const q = busca.toLowerCase();
    return vendas.filter(v =>
      v.clienteNome?.toLowerCase().includes(q) ||
      v.numero_venda?.toString().includes(q) ||
      v.formaPagamento?.toLowerCase().includes(q)
    );
  }, [vendas, busca]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const abrirForm = useCallback(() => {
    setForm(FORM_INICIAL);
    setMostrarForm(true);
  }, []);

  const fecharForm = useCallback(() => {
    setMostrarForm(false);
    setForm(FORM_INICIAL);
  }, []);

  const atualizarItem = useCallback((id: string, changes: Partial<ItemVenda>) => {
    setForm(prev => ({
      ...prev,
      itens: prev.itens.map(i => i.id === id ? { ...i, ...changes } : i),
    }));
  }, []);

  const adicionarItem = useCallback((item: ItemVenda) => {
    setForm(prev => ({ ...prev, itens: [...prev.itens, item] }));
  }, []);

  const removerItem = useCallback((id: string) => {
    setForm(prev => ({ ...prev, itens: prev.itens.filter(i => i.id !== id) }));
  }, []);

  const salvarVenda = useCallback(async (): Promise<boolean> => {
    if (form.itens.length === 0) {
      showToast('Adicione pelo menos um item', 'error');
      return false;
    }

    // Validar produtos cadastrados
    const invalidos = form.itens.filter(i => !i.isManual && i.produtoId && !produtosMap.has(i.produtoId));
    if (invalidos.length > 0) {
      showToast('Um ou mais produtos são inválidos', 'error');
      return false;
    }

    const session = getCurrentSession();
    if (!session) {
      showToast('Sessão expirada — faça login novamente', 'error');
      return false;
    }

    setIsSaving(true);
    try {
      const venda = await criarVenda({
        itens: form.itens.map(i => ({
          produtoId: i.produtoId,
          isManual: i.isManual,
          produtoNome: i.descricao,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco: i.preco,
          precoUnitario: i.preco,
          subtotal: i.quantidade * i.preco,
          custo: i.produtoId ? (produtosMap.get(i.produtoId)?.custo ?? 0) : 0,
        })),
        clienteId: form.clienteId || undefined,
        formaPagamento: form.formaPagamento as import('@/types').FormaPagamento,
        desconto: form.desconto,
        desconto_tipo: form.desconto_tipo,
        observacoes: form.observacoes,
        parcelas: form.parcelas,
        taxa_cartao_percentual: form.taxa_cartao_percentual,
        total: totais.totalBruto,
        vendedor: session.username,
      });

      if (!venda) {
        showToast('Erro ao registrar venda', 'error');
        return false;
      }

      setVendas(getVendas());
      showToast('✅ Venda registrada com sucesso!', 'success');
      fecharForm();
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [form, totais, produtosMap, fecharForm]);

  return {
    // Estado
    vendas,
    vendasFiltradas,
    produtos,
    produtosMap,
    form,
    mostrarForm,
    isSaving,
    busca,
    loading,
    totais,
    // Setters simples
    setForm,
    setBusca,
    // Handlers compostos
    abrirForm,
    fecharForm,
    adicionarItem,
    atualizarItem,
    removerItem,
    salvarVenda,
    recarregar: () => setVendas(getVendas()),
  };
}
