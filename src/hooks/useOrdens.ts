/**
 * useOrdens — Hook de negócio para Ordens de Serviço (P2 — God Component refactoring)
 *
 * Extrai toda lógica de estado e operações de OrdensPage.tsx.
 * A page fica responsável apenas por renderização.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { OrdemServico, StatusOrdem } from '@/types';
import { getOrdens, criarOrdem, atualizarOrdem, deletarOrdem, buscarOrdens } from '@/lib/ordens';
import { getClientes } from '@/lib/clientes';
import { showToast } from '@/components/ui/ToastContainer';
import { getCurrentSession, isAdmin } from '@/lib/auth-supabase';
import { canCreate, canEdit, canDelete } from '@/lib/permissions';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface FormOrdem {
  clienteId: string;
  clienteTelefone: string;
  equipamento: string;
  marca: string;
  modelo: string;
  cor: string;
  defeito: string;
  defeito_tipo: string;
  defeito_descricao: string;
  situacao: string;
  observacoes: string;
  acessorios: string[];
  status: StatusOrdem;
  valorServico: string;
  valorPecas: string;
  formaPagamento: string;
  parcelas: number;
  tecnico: string;
  dataPrevisao: string;
  senhaCliente: string;
  senhaPadrao: string;
  laudoTecnico: string;
  warranty_terms_enabled: boolean;
}

const FORM_INICIAL: FormOrdem = {
  clienteId: '',
  clienteTelefone: '',
  equipamento: '',
  marca: '',
  modelo: '',
  cor: '',
  defeito: '',
  defeito_tipo: '',
  defeito_descricao: '',
  situacao: '',
  observacoes: '',
  acessorios: [],
  status: 'aberta',
  valorServico: '',
  valorPecas: '',
  formaPagamento: 'dinheiro',
  parcelas: 1,
  tecnico: '',
  dataPrevisao: '',
  senhaCliente: '',
  senhaPadrao: '',
  laudoTecnico: '',
  warranty_terms_enabled: false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOrdens() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [form, setForm] = useState<FormOrdem>(FORM_INICIAL);
  const [ordemEditando, setOrdemEditando] = useState<OrdemServico | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusOrdem | null>(null);
  const [loading, setLoading] = useState(true);

  const session = getCurrentSession();
  const podeEditar = canEdit();
  const podeCriar = canCreate();
  const podeDeletar = canDelete();

  // ── Load inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    setOrdens(getOrdens());
    setLoading(false);

    const onUpdate = () => setOrdens(getOrdens());
    window.addEventListener('storage', onUpdate);
    return () => window.removeEventListener('storage', onUpdate);
  }, []);

  // ── Clientes (carregados sob demanda) ─────────────────────────────────────
  const clientes = useMemo(() => getClientes(), []);

  // ── Filtro ────────────────────────────────────────────────────────────────
  const ordensFiltradas = useMemo(() => {
    let list = ordens;
    if (filtroStatus) list = list.filter(o => o.status === filtroStatus);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(o =>
        o.numero?.toString().includes(q) ||
        o.clienteNome?.toLowerCase().includes(q) ||
        o.equipamento?.toLowerCase().includes(q) ||
        o.marca?.toLowerCase().includes(q) ||
        o.modelo?.toLowerCase().includes(q) ||
        o.defeito?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [ordens, filtroStatus, busca]);

  // ── Contagem por status (memoizada) ───────────────────────────────────────
  const contadores = useMemo(() => ({
    total: ordens.length,
    aberta: ordens.filter(o => o.status === 'aberta').length,
    emAndamento: ordens.filter(o => o.status === 'em_andamento').length,
    aguardandoPeca: ordens.filter(o => o.status === 'aguardando_peca').length,
    concluida: ordens.filter(o => o.status === 'concluida').length,
    cancelada: ordens.filter(o => o.status === 'cancelada').length,
  }), [ordens]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const abrirNovaOrdem = useCallback(() => {
    if (!podeCriar) { showToast('Sem permissão para criar ordens', 'error'); return; }
    setOrdemEditando(null);
    setForm(FORM_INICIAL);
    setMostrarForm(true);
  }, [podeCriar]);

  const abrirEdicao = useCallback((ordem: OrdemServico) => {
    if (!podeEditar) { showToast('Sem permissão para editar ordens', 'error'); return; }
    setOrdemEditando(ordem);
    setForm({
      clienteId: ordem.clienteId || '',
      clienteTelefone: ordem.clienteTelefone || '',
      equipamento: ordem.equipamento || '',
      marca: ordem.marca || '',
      modelo: ordem.modelo || '',
      cor: ordem.cor || '',
      defeito: ordem.defeito || '',
      defeito_tipo: (ordem as any).defeito_tipo || '',
      defeito_descricao: (ordem as any).defeito_descricao || '',
      situacao: (ordem as any).situacao || '',
      observacoes: ordem.observacoes || '',
      acessorios: (ordem as any).acessorios || [],
      status: ordem.status,
      valorServico: String(ordem.valorServico ?? ''),
      valorPecas: String(ordem.valorPecas ?? ''),
      formaPagamento: ordem.formaPagamento || 'dinheiro',
      parcelas: (ordem as any).parcelas || 1,
      tecnico: (ordem as any).tecnico || '',
      dataPrevisao: (ordem as any).dataPrevisao || '',
      senhaCliente: (ordem as any).senhaCliente || '',
      senhaPadrao: (ordem as any).senhaPadrao || '',
      laudoTecnico: (ordem as any).laudoTecnico || '',
      warranty_terms_enabled: (ordem as any).warranty_terms_enabled ?? false,
    });
    setMostrarForm(true);
  }, [podeEditar]);

  const fecharForm = useCallback(() => {
    setMostrarForm(false);
    setOrdemEditando(null);
    setForm(FORM_INICIAL);
  }, []);

  const salvarOrdem = useCallback(async (): Promise<boolean> => {
    if (!form.clienteId) { showToast('Selecione o cliente', 'error'); return false; }
    if (!form.equipamento) { showToast('Informe o equipamento', 'error'); return false; }

    setIsSaving(true);
    try {
      if (ordemEditando) {
        const updated = await atualizarOrdem(ordemEditando.id, {
          ...form,
          valorServico: Number(form.valorServico) || 0,
          valorPecas: Number(form.valorPecas) || 0,
          formaPagamento: form.formaPagamento as import('@/types').FormaPagamento | undefined,
        });
        if (!updated) { showToast('Erro ao atualizar ordem', 'error'); return false; }
        showToast('✅ Ordem atualizada!', 'success');
      } else {
        const clienteSelecionado = clientes.find(c => c.id === form.clienteId);
        const nova = await criarOrdem({
          ...form,
          valorServico: Number(form.valorServico) || 0,
          valorPecas: Number(form.valorPecas) || 0,
          tecnico: session?.username,
          clienteNome: clienteSelecionado?.nome ?? form.clienteId,
          formaPagamento: form.formaPagamento as import('@/types').FormaPagamento | undefined,
        });
        if (!nova) { showToast('Erro ao criar ordem', 'error'); return false; }
        showToast('✅ Ordem criada!', 'success');
      }

      setOrdens(getOrdens());
      fecharForm();
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [form, ordemEditando, session, fecharForm]);

  const excluirOrdem = useCallback(async (id: string): Promise<boolean> => {
    if (!podeDeletar) { showToast('Sem permissão para excluir', 'error'); return false; }
    const ok = await deletarOrdem(id);
    if (ok) {
      setOrdens(getOrdens());
      showToast('Ordem excluída', 'success');
    } else {
      showToast('Erro ao excluir ordem', 'error');
    }
    return ok;
  }, [podeDeletar]);

  const atualizarStatus = useCallback(async (id: string, status: StatusOrdem): Promise<boolean> => {
    if (!podeEditar) return false;
    const ok = await atualizarOrdem(id, { status });
    if (ok) setOrdens(getOrdens());
    return !!ok;
  }, [podeEditar]);

  return {
    // Estado
    ordens,
    ordensFiltradas,
    clientes,
    form,
    ordemEditando,
    mostrarForm,
    isSaving,
    busca,
    filtroStatus,
    loading,
    contadores,
    // Permissões
    podeCriar,
    podeEditar,
    podeDeletar,
    isAdmin: isAdmin(),
    // Setters
    setForm,
    setBusca,
    setFiltroStatus,
    // Handlers
    abrirNovaOrdem,
    abrirEdicao,
    fecharForm,
    salvarOrdem,
    excluirOrdem,
    atualizarStatus,
    recarregar: () => setOrdens(getOrdens()),
  };
}
