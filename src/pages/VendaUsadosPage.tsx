import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/ToastContainer';
import { getPessoas, criarPessoa } from '@/lib/pessoas';
import {
  getUsados,
  getUsadosEmEstoque,
  registrarVendaUsado,
  registrarVendaAvulsoUsado,
  getVendasUsados,
  deletarVendaUsado,
} from '@/lib/usados';
import type { Pessoa, Usado, UsadoVenda } from '@/types';
import PrintButton from '@/components/ui/PrintButton';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { type PrintData, printDocument, type TamanhoPapel } from '@/lib/print-template';
import { getWarrantySettings, upsertWarrantySettings } from '@/lib/settings';
import { pessoasRepo, usadosRepo, usadosVendasRepo } from '@/lib/repositories';
import { hydrateUiPref, readUiPrefBoolLocal, readUiPrefLocal, readUiPrefNumberLocal, setUiPref } from '@/lib/ui-prefs';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import { printReceipt } from '@/services/print/receipt-service';
import Pagination from '@/components/ui/Pagination';
import './UsadosPages.css';

type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'outro';

const WARRANTY_PINNED_KEY = 'smarttech.venda_usados.warranty.pinned';
const WARRANTY_MONTHS_KEY = 'smarttech.venda_usados.warranty.months';
const WARRANTY_TERMS_PINNED_KEY = 'smarttech.venda_usados.warrantyTerms.pinned';
const WARRANTY_TERMS_KEY = 'smarttech.venda_usados.warrantyTerms.text';

const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'DINHEIRO',
  pix: 'PIX',
  debito: 'DÉBITO',
  credito: 'CRÉDITO',
  boleto: 'BOLETO',
  outro: 'OUTRO',
};

function formatGarantiaLabel(months?: number): string | undefined {
  if (!months || months <= 0) return undefined;
  return `${months} ${months === 1 ? 'mês' : 'meses'}`;
}

function buildItemDetails(usado?: Usado | null): string | undefined {
  if (!usado) return undefined;
  const detalhes = [
    usado.imei ? `IMEI: ${usado.imei}` : '',
    usado.descricao ? String(usado.descricao).trim() : '',
  ]
    .filter(Boolean)
    .join(' • ')
    .trim();

  return detalhes || undefined;
}

function buildPrintData(params: {
  venda: UsadoVenda;
  usado?: Usado | null;
  comprador?: Pessoa | null;
  buyerFallback?: { nome?: string; telefone?: string; cpfCnpj?: string; endereco?: string };
}): PrintData {
  const { venda, usado, comprador, buyerFallback } = params;
  const valorVenda = Number(venda.valorVenda || 0);
  const numero = venda.id ? `US-${String(venda.id).slice(-6).toUpperCase()}` : 'USADO';

  return {
    tipo: 'venda',
    numero,
    data: venda.dataVenda || new Date().toISOString(),
    clienteNome: comprador?.nome || buyerFallback?.nome?.trim() || 'Cliente',
    clienteTelefone: comprador?.telefone || buyerFallback?.telefone?.trim() || undefined,
    cpfCnpj: comprador?.cpfCnpj || buyerFallback?.cpfCnpj?.trim() || undefined,
    clienteEndereco: comprador?.endereco || buyerFallback?.endereco?.trim() || undefined,
    itens: [
      {
        nome: usado?.titulo || 'Item vendido',
        quantidade: 1,
        preco: valorVenda,
        descricao: buildItemDetails(usado),
      },
    ],
    valorTotal: valorVenda,
    formaPagamento:
      FORMA_PAGAMENTO_LABEL[(venda.formaPagamento as FormaPagamento) || 'dinheiro'] ||
      String(venda.formaPagamento || 'dinheiro').toUpperCase(),
    garantia: formatGarantiaLabel(venda.warranty_months),
    termosGarantia: venda.warranty_terms?.trim() || undefined,
    observacoes: venda.observacoes?.trim() || undefined,
  };
}

const SALES_PER_PAGE = 10;

function VendaUsadosPage() {
  const passwordPrompt = usePasswordPrompt();
  const [vendaParaDeletar, setVendaParaDeletar] = useState<string | null>(null);

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [estoque, setEstoque] = useState<Usado[]>([]);
  const [todosUsados, setTodosUsados] = useState<Usado[]>([]);
  const [vendas, setVendas] = useState<UsadoVenda[]>([]);
  const [salesPage, setSalesPage] = useState(1);

  const [selectedUsadoId, setSelectedUsadoId] = useState('');
  const [itemModo, setItemModo] = useState<'estoque' | 'avulso'>('estoque');
  const [avulsoForm, setAvulsoForm] = useState({ modelo: '', cor: '', imei: '', descricao: '' });

  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [buyerForm, setBuyerForm] = useState({ nome: '', telefone: '', cpfCnpj: '', endereco: '' });

  const [valorVenda, setValorVenda] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('dinheiro');
  const [saving, setSaving] = useState(false);
  const [lastPrint, setLastPrint] = useState<PrintData | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [warrantyMonths, setWarrantyMonths] = useState<number>(0);
  const [warrantyPinned, setWarrantyPinned] = useState(false);
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [warrantyTermsPinned, setWarrantyTermsPinned] = useState(false);
  const [savingWarrantyTerms, setSavingWarrantyTerms] = useState(false);
  const isLoadingDataRef = useRef(false);
  const reloadPendingRef = useRef(false);
  const reloadTimerRef = useRef<number | null>(null);

  const pessoaById = useMemo(() => new Map(pessoas.map((p) => [p.id, p] as const)), [pessoas]);
  const usadoById = useMemo(() => new Map(todosUsados.map((u) => [u.id, u] as const)), [todosUsados]);
  const compradoresOrdenados = useMemo(() => pessoas.slice().sort((a, b) => a.nome.localeCompare(b.nome)), [pessoas]);
  const vendasOrdenadas = useMemo(() => vendas.slice().sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || '')), [vendas]);
  const salesTotalPages = Math.max(1, Math.ceil(vendasOrdenadas.length / SALES_PER_PAGE));
  const vendasPaginadas = useMemo(() => {
    const start = (salesPage - 1) * SALES_PER_PAGE;
    return vendasOrdenadas.slice(start, start + SALES_PER_PAGE);
  }, [vendasOrdenadas, salesPage]);
  const salesStartIndex = vendasOrdenadas.length === 0 ? 0 : (salesPage - 1) * SALES_PER_PAGE + 1;
  const salesEndIndex = Math.min(vendasOrdenadas.length, salesPage * SALES_PER_PAGE);

  const resumoVendas = useMemo(() => {
    const hoje = new Date();
    const inicioHoje = new Date(hoje);
    inicioHoje.setHours(0, 0, 0, 0);

    const totalVendido = vendas.reduce((acc, venda) => acc + Number(venda.valorVenda || 0), 0);
    const totalVendidoHoje = vendas.reduce((acc, venda) => {
      const data = venda.dataVenda ? new Date(venda.dataVenda) : null;
      if (!data || Number.isNaN(data.getTime()) || data < inicioHoje) return acc;
      return acc + Number(venda.valorVenda || 0);
    }, 0);

    return {
      estoqueDisponivel: estoque.length,
      vendasRegistradas: vendas.length,
      totalVendidoHoje,
      ticketMedio: vendas.length ? totalVendido / vendas.length : 0,
    };
  }, [estoque.length, vendas]);

  const carregarDados = useCallback(async (reason: string = 'manual') => {
    if (isLoadingDataRef.current) {
      reloadPendingRef.current = true;
      return;
    }

    isLoadingDataRef.current = true;
    await Promise.allSettled([
      pessoasRepo.preloadLocal(),
      usadosRepo.preloadLocal(),
      usadosVendasRepo.preloadLocal(),
    ]);

    try {
      const pessoasData = getPessoas();
      const usadosData = getUsados();
      const estoqueData = getUsadosEmEstoque();
      const vendasData = getVendasUsados();

      setPessoas(pessoasData);
      setTodosUsados(usadosData);
      setEstoque(estoqueData);
      setVendas(vendasData);

      const ultimaVenda = [...vendasData]
        .sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || ''))
        .at(0);

      if (ultimaVenda) {
        const usado = usadosData.find((u) => u.id === ultimaVenda.usadoId) || null;
        const comprador = pessoasData.find((p) => p.id === ultimaVenda.compradorId) || null;
        setLastPrint(buildPrintData({ venda: ultimaVenda, usado, comprador }));
        setLastSaleId(ultimaVenda.id);
      } else {
        setLastPrint(null);
        setLastSaleId(null);
      }
    } finally {
      isLoadingDataRef.current = false;
      if (reloadPendingRef.current) {
        reloadPendingRef.current = false;
        window.setTimeout(() => {
          void carregarDados('queued');
        }, 80);
      }
    }
  }, []);

  const scheduleDadosReload = useCallback((reason: string, delay = 120) => {
    if (reloadTimerRef.current) {
      window.clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void carregarDados(reason);
    }, delay);
  }, [carregarDados]);

  useEffect(() => {
    setSalesPage(1);
  }, [vendas.length]);

  useEffect(() => {
    void carregarDados('mount');

    const atualizar = () => scheduleDadosReload('event');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleDadosReload('visible', 0);
    };

    window.addEventListener('storage', atualizar);
    window.addEventListener('smart-tech-venda-usado-criada', atualizar as any);
    window.addEventListener('smart-tech-venda-usado-deletada', atualizar as any);
    window.addEventListener('smart-tech-usado-deletado', atualizar as any);
    window.addEventListener('smarttech:sqlite-ready', atualizar as any);
    window.addEventListener('smarttech:store-changed', atualizar as any);
    document.addEventListener('visibilitychange', onVisibility);

    const pinned = readUiPrefBoolLocal(WARRANTY_PINNED_KEY, false);
    const meses = Math.max(0, Math.min(12, readUiPrefNumberLocal(WARRANTY_MONTHS_KEY, 0)));
    setWarrantyPinned(pinned);
    setWarrantyMonths(pinned ? meses : 0);

    const termsPinned = readUiPrefBoolLocal(WARRANTY_TERMS_PINNED_KEY, false);
    const terms = readUiPrefLocal(WARRANTY_TERMS_KEY, '');
    setWarrantyTermsPinned(termsPinned);
    setWarrantyTerms(termsPinned ? terms : '');

    void (async () => {
      const [pinnedRaw, monthsRaw, termsPinnedRaw, termsRaw] = await Promise.all([
        hydrateUiPref(WARRANTY_PINNED_KEY),
        hydrateUiPref(WARRANTY_MONTHS_KEY),
        hydrateUiPref(WARRANTY_TERMS_PINNED_KEY),
        hydrateUiPref(WARRANTY_TERMS_KEY),
      ]);

      const nextPinned = pinnedRaw === '1' || pinnedRaw === 'true';
      const nextMonths = Math.max(0, Math.min(12, Number(monthsRaw || 0) || 0));
      const nextTermsPinned = termsPinnedRaw === '1' || termsPinnedRaw === 'true';
      const nextTerms = String(termsRaw || '');

      setWarrantyPinned(nextPinned);
      setWarrantyMonths(nextPinned ? nextMonths : 0);
      setWarrantyTermsPinned(nextTermsPinned);
      setWarrantyTerms(nextTermsPinned ? nextTerms : '');
    })();

    void (async () => {
      const res = await getWarrantySettings();
      if (res.success && res.data) {
        const s = res.data;
        try {
          if (s.warranty_months_pinned && typeof s.default_warranty_months === 'number') {
            const meses = Math.max(0, Math.min(12, Math.floor(s.default_warranty_months)));
            setWarrantyPinned(true);
            setWarrantyMonths(meses);
            void setUiPref(WARRANTY_PINNED_KEY, '1');
            void setUiPref(WARRANTY_MONTHS_KEY, String(meses));
          }

          if (s.warranty_terms_pinned) {
            const t = String(s.warranty_terms || '').trim();
            setWarrantyTermsPinned(true);
            setWarrantyTerms(t);
            void setUiPref(WARRANTY_TERMS_PINNED_KEY, '1');
            void setUiPref(WARRANTY_TERMS_KEY, t);
          }
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      window.removeEventListener('storage', atualizar);
      window.removeEventListener('smart-tech-venda-usado-criada', atualizar as any);
      window.removeEventListener('smart-tech-venda-usado-deletada', atualizar as any);
      window.removeEventListener('smart-tech-usado-deletado', atualizar as any);
      window.removeEventListener('smarttech:sqlite-ready', atualizar as any);
      window.removeEventListener('smarttech:store-changed', atualizar as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarDados, scheduleDadosReload]);

  const usadoSelecionado = useMemo(
    () => estoque.find((u) => u.id === selectedUsadoId) || null,
    [estoque, selectedUsadoId]
  );

  useEffect(() => {
    if (itemModo === 'estoque' && estoque.length === 0) setItemModo('avulso');
  }, [estoque.length, itemModo]);

  const handlePrintData = (data: PrintData, paperSize?: TamanhoPapel) => {
    printDocument(data, {
      paperSize,
      printMode: paperSize === 'A4' ? 'normal' : 'compact',
    });
  };

  const handleImprimirUltimaVenda = async (paperSize?: TamanhoPapel) => {
    if (!lastPrint) return;
    if (paperSize === '58mm' || paperSize === '80mm') {
      if (!lastSaleId) return;
      await printReceipt({
        type: 'used-sale',
        id: lastSaleId,
        paperWidth: paperSize === '80mm' ? '80' : '58',
      });
      return;
    }
    handlePrintData(lastPrint, paperSize);
  };

  const handleImprimirVenda = async (venda: UsadoVenda, paperSize?: TamanhoPapel) => {
    const usado = todosUsados.find((u) => u.id === venda.usadoId) || null;
    const comprador = pessoas.find((p) => p.id === venda.compradorId) || null;
    const printData = buildPrintData({ venda, usado, comprador });
    setLastPrint(printData);
    setLastSaleId(venda.id);

    if (paperSize === '58mm' || paperSize === '80mm') {
      await printReceipt({
        type: 'used-sale',
        id: venda.id,
        paperWidth: paperSize === '80mm' ? '80' : '58',
      });
      return;
    }

    handlePrintData(printData, paperSize);
  };

  const handleDeletar = (id: string) => {
    setVendaParaDeletar(id);
    passwordPrompt.requestPassword(() => executarExclusao(id));
  };

  const executarExclusao = async (id: string) => {
    try {
      const sucesso = await deletarVendaUsado(id);
      if (sucesso) {
        showToast('✅ Venda excluída e estornada! Item retornado ao estoque.', 'success');
        carregarDados();
      } else {
        showToast('❌ Erro ao excluir venda', 'error');
      }
    } catch {
      showToast('❌ Erro ao excluir venda', 'error');
    } finally {
      setVendaParaDeletar(null);
    }
  };

  const syncWarrantyTermsLocal = (pinned: boolean, text: string) => {
    if (pinned) {
      void setUiPref(WARRANTY_TERMS_PINNED_KEY, '1');
      void setUiPref(WARRANTY_TERMS_KEY, text);
    } else {
      void setUiPref(WARRANTY_TERMS_PINNED_KEY, null);
    }
  };

  const handleToggleFixarTermosGarantia = () => {
    if (savingWarrantyTerms) return;

    void (async () => {
      setSavingWarrantyTerms(true);
      try {
        if (warrantyTermsPinned) {
          const res = await upsertWarrantySettings({ warranty_terms_pinned: false });
          if (!res.success) throw new Error(res.error || 'Não foi possível desafixar');
          setWarrantyTermsPinned(false);
          syncWarrantyTermsLocal(false, warrantyTerms);
          showToast('✅ Termos de garantia desafixados', 'success');
        } else {
          const t = String(warrantyTerms || '').trim();
          const res = await upsertWarrantySettings({
            warranty_terms: t,
            warranty_terms_pinned: true,
            warranty_terms_enabled: true,
          });
          if (!res.success) throw new Error(res.error || 'Não foi possível fixar');
          setWarrantyTerms(t);
          setWarrantyTermsPinned(true);
          syncWarrantyTermsLocal(true, t);
          showToast('✅ Termos de garantia fixados como padrão', 'success');
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Falha ao salvar termos de garantia';
        showToast(`❌ ${msg}`, 'error');
      } finally {
        setSavingWarrantyTerms(false);
      }
    })();
  };

  const handleSalvarTermosGarantia = () => {
    if (savingWarrantyTerms) return;

    void (async () => {
      setSavingWarrantyTerms(true);
      try {
        const t = String(warrantyTerms || '').trim();
        const res = await upsertWarrantySettings({
          warranty_terms: t,
          warranty_terms_pinned: true,
          warranty_terms_enabled: true,
        });
        if (!res.success) throw new Error(res.error || 'Não foi possível salvar');
        setWarrantyTerms(t);
        setWarrantyTermsPinned(true);
        syncWarrantyTermsLocal(true, t);
        showToast('✅ Termos de garantia salvos', 'success');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Falha ao salvar termos de garantia';
        showToast(`❌ ${msg}`, 'error');
      } finally {
        setSavingWarrantyTerms(false);
      }
    })();
  };

  const handleConfirm = async () => {
    if (saving) return;

    setErrorMessage('');
    setSuccessMessage('');

    const valorNum = Number(String(valorVenda).replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      setErrorMessage('Informe um valor de venda válido');
      return;
    }

    let compradorId = selectedBuyerId || '';
    let comprador = pessoas.find((c) => c.id === compradorId);

    if (!compradorId && buyerForm.nome.trim()) {
      const created = await criarPessoa({
        nome: buyerForm.nome.trim(),
        telefone: buyerForm.telefone?.trim() || undefined,
        cpfCnpj: buyerForm.cpfCnpj?.trim() || undefined,
        endereco: buyerForm.endereco?.trim() || undefined,
      });

      if (created) {
        compradorId = created.id;
        comprador = created;
        setPessoas((prev) => [created, ...prev]);
      }
    }

    if (itemModo === 'estoque') {
      if (!selectedUsadoId) {
        setErrorMessage('Selecione um item em estoque ou escolha “Avulso”');
        return;
      }
    } else if (!avulsoForm.modelo.trim()) {
      setErrorMessage('Informe o modelo/título do item avulso');
      return;
    }

    const termosGarantia = warrantyTerms?.trim() || undefined;
    const dataVenda = new Date().toISOString();

    setSaving(true);

    try {
      const vendaRes =
        itemModo === 'estoque'
          ? await registrarVendaUsado(selectedUsadoId, {
              compradorId: compradorId || undefined,
              valorVenda: valorNum,
              formaPagamento,
              dataVenda,
              observacoes: observacoes?.trim() || undefined,
              warranty_months: warrantyMonths || undefined,
              warranty_terms: termosGarantia,
            })
          : await registrarVendaAvulsoUsado(
              {
                modelo: avulsoForm.modelo.trim(),
                cor: avulsoForm.cor.trim() || undefined,
                imei: avulsoForm.imei.trim() || undefined,
                descricao: avulsoForm.descricao.trim() || undefined,
              },
              {
                compradorId: compradorId || undefined,
                valorVenda: valorNum,
                formaPagamento,
                dataVenda,
                observacoes: observacoes?.trim() || undefined,
                warranty_months: warrantyMonths || undefined,
                warranty_terms: termosGarantia,
              }
            );

      if (!vendaRes.success || !vendaRes.venda || !vendaRes.usado) {
        setErrorMessage(vendaRes.error || 'Erro ao registrar venda');
        return;
      }

      const printData = buildPrintData({
        venda: vendaRes.venda,
        usado: vendaRes.usado,
        comprador: comprador || null,
        buyerFallback: buyerForm,
      });

      setLastPrint(printData);
      setLastSaleId(vendaRes.venda.id);
      setSuccessMessage('Venda registrada com sucesso!');

      setValorVenda('');
      setObservacoes('');
      if (!warrantyPinned) setWarrantyMonths(0);
      if (!warrantyTermsPinned) setWarrantyTerms('');
      if (itemModo === 'estoque') setSelectedUsadoId('');
      setAvulsoForm({ modelo: '', cor: '', imei: '', descricao: '' });

      carregarDados();
    } catch (error) {
      console.error('[VendaUsados] Erro ao confirmar venda:', error);
      setErrorMessage('Erro ao confirmar venda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container usados-page">
      <div className="page-header">
        <div className="usados-page-head">
          <div>
            <h1>🧾 Compra & Venda (Usados) — Venda</h1>
            <p>Selecione um item em estoque, comprador e confirme a venda</p>
          </div>
          <div className="usados-page-head-actions">
            {lastPrint && (
              <>
                <PrintButton onPrint={() => handleImprimirUltimaVenda('80mm')} title="Imprimir última venda em 80mm">
                  🖨️ 80mm
                </PrintButton>
                <PrintButton onPrint={() => handleImprimirUltimaVenda('58mm')} title="Imprimir última venda em 58mm">
                  🖨️ 58mm
                </PrintButton>
                <PrintButton onPrint={() => handleImprimirUltimaVenda('A4')} title="Imprimir última venda em A4">
                  🖨️ A4
                </PrintButton>
              </>
            )}
            {lastPrint && lastPrint.clienteTelefone && (
              <WhatsAppButton
                telefone={lastPrint.clienteTelefone}
                mensagem={`Olá! Segue comprovante da venda do aparelho usado ${lastPrint.itens?.[0]?.nome || ''} - Valor: R$ ${(lastPrint.valorTotal || 0).toFixed(2).replace('.', ',')} - Obrigado pela preferência!`}
              />
            )}
          </div>
        </div>
      </div>

      <section className="usados-summary-grid">
        <div className="usados-summary-card">
          <span className="usados-summary-label">Estoque disponível</span>
          <strong className="usados-summary-value">{resumoVendas.estoqueDisponivel}</strong>
          <span className="usados-summary-helper">Itens prontos para venda imediata.</span>
        </div>
        <div className="usados-summary-card">
          <span className="usados-summary-label">Vendas registradas</span>
          <strong className="usados-summary-value">{resumoVendas.vendasRegistradas}</strong>
          <span className="usados-summary-helper">Histórico consolidado do módulo de usados.</span>
        </div>
        <div className="usados-summary-card">
          <span className="usados-summary-label">Hoje / Ticket médio</span>
          <strong className="usados-summary-value">
            R$ {resumoVendas.totalVendidoHoje.toFixed(2).replace('.', ',')} • R$ {resumoVendas.ticketMedio.toFixed(2).replace('.', ',')}
          </strong>
          <span className="usados-summary-helper">Leitura rápida da operação sem abrir relatórios.</span>
        </div>
      </section>

      <div className="usados-grid">
        <div className="usados-card">
          <h2>📦 Item</h2>

          <div className="usados-toggle">
            <button
              type="button"
              className={itemModo === 'estoque' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setItemModo('estoque')}
            >
              📦 Estoque
            </button>

            <button
              type="button"
              className={itemModo === 'avulso' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setItemModo('avulso')}
            >
              ＋ Avulso
            </button>
          </div>

          {itemModo === 'estoque' ? (
            <>
              <label className="usados-label">Selecionar</label>
              <select
                className="usados-input"
                value={selectedUsadoId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__avulso__') {
                    setSelectedUsadoId('');
                    setItemModo('avulso');
                    return;
                  }
                  setSelectedUsadoId(v);
                }}
              >
                <option value="">— Selecione —</option>
                <option value="__avulso__">＋ Celular avulso (digitar manualmente)</option>
                {estoque.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.titulo} — R$ {u.valorCompra.toFixed(2)}
                  </option>
                ))}
              </select>

              {usadoSelecionado ? (
                <div className="usados-info">
                  <div>
                    <strong>{usadoSelecionado.titulo}</strong>
                  </div>
                  {usadoSelecionado.imei ? <div>IMEI: {usadoSelecionado.imei}</div> : null}
                  {usadoSelecionado.descricao ? <div className="muted">{usadoSelecionado.descricao}</div> : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <label className="usados-label">Modelo/Título *</label>
              <input
                className="usados-input"
                value={avulsoForm.modelo}
                onChange={(e) => setAvulsoForm((p) => ({ ...p, modelo: e.target.value }))}
                placeholder="Ex: iPhone 13"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="usados-label">Cor</label>
                  <input
                    className="usados-input"
                    value={avulsoForm.cor}
                    onChange={(e) => setAvulsoForm((p) => ({ ...p, cor: e.target.value }))}
                    placeholder="Ex: Branco"
                  />
                </div>

                <div>
                  <label className="usados-label">IMEI</label>
                  <input
                    className="usados-input"
                    value={avulsoForm.imei}
                    onChange={(e) => setAvulsoForm((p) => ({ ...p, imei: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <label className="usados-label">Descrição (opcional)</label>
              <textarea
                className="usados-textarea"
                rows={4}
                value={avulsoForm.descricao}
                onChange={(e) => setAvulsoForm((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Acompanha carregador. Sem marcas."
              />

              {avulsoForm.modelo.trim() || avulsoForm.cor.trim() || avulsoForm.imei.trim() ? (
                <div className="usados-info">
                  <div>
                    <strong>{[avulsoForm.modelo.trim(), avulsoForm.cor.trim()].filter(Boolean).join(' - ')}</strong>
                  </div>
                  {avulsoForm.imei.trim() ? <div>IMEI: {avulsoForm.imei.trim()}</div> : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="usados-card">
          <h2>👤 Comprador</h2>
          <label className="usados-label">Selecionar existente (opcional)</label>
          <select
            className="usados-input"
            value={selectedBuyerId}
            onChange={(e) => setSelectedBuyerId(e.target.value)}
            disabled={saving}
          >
            <option value="">— Novo comprador —</option>
            {compradoresOrdenados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
          </select>

          {!selectedBuyerId && (
            <div className="usados-form">
              <label className="usados-label">Nome *</label>
              <input
                className="usados-input"
                value={buyerForm.nome}
                onChange={(e) => setBuyerForm((p) => ({ ...p, nome: e.target.value }))}
                disabled={saving}
              />
              <label className="usados-label">Telefone</label>
              <input
                className="usados-input"
                value={buyerForm.telefone}
                onChange={(e) => setBuyerForm((p) => ({ ...p, telefone: e.target.value }))}
                disabled={saving}
                inputMode="tel"
              />
              <label className="usados-label">CPF/CNPJ</label>
              <input
                className="usados-input"
                value={buyerForm.cpfCnpj}
                onChange={(e) => setBuyerForm((p) => ({ ...p, cpfCnpj: e.target.value }))}
                disabled={saving}
                inputMode="numeric"
              />
              <label className="usados-label">Endereço</label>
              <input
                className="usados-input"
                value={buyerForm.endereco}
                onChange={(e) => setBuyerForm((p) => ({ ...p, endereco: e.target.value }))}
                disabled={saving}
              />
            </div>
          )}
        </div>

        <div className="usados-card">
          <h2>💰 Venda</h2>
          <label className="usados-label">Valor de venda (R$) *</label>
          <input
            className="usados-input"
            type="number"
            min="0"
            step="0.01"
            value={valorVenda}
            onChange={(e) => setValorVenda(e.target.value)}
            disabled={saving}
            inputMode="decimal"
          />
          <label className="usados-label">Forma de pagamento *</label>
          <select
            className="usados-input"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
            disabled={saving}
          >
            <option value="dinheiro">💵 Dinheiro</option>
            <option value="pix">📱 PIX</option>
            <option value="debito">💳 Débito</option>
            <option value="credito">💳 Crédito</option>
            <option value="boleto">📄 Boleto</option>
            <option value="outro">💰 Outro</option>
          </select>
          <label className="usados-label">Observações</label>
          <textarea
            className="usados-textarea"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={saving}
            rows={4}
          />
        </div>

        <div className="usados-card">
          <h2>🛡️ Garantia</h2>

          <label className="usados-label">Prazo (0 = sem, 1 a 12 meses)</label>
          <select
            className="usados-input"
            value={warrantyMonths}
            onChange={(e) => {
              const meses = Math.max(0, Math.min(12, Number(e.target.value) || 0));
              setWarrantyMonths(meses);
              try {
                if (warrantyPinned) void setUiPref(WARRANTY_MONTHS_KEY, String(meses));
              } catch {
                // ignore
              }
            }}
          >
            <option value={0}>Sem garantia</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'mês' : 'meses'}
              </option>
            ))}
          </select>

          <label className="usados-label usados-label--spaced">
            Termos da garantia (opcional)
          </label>
          <textarea
            className="usados-textarea"
            rows={6}
            value={warrantyTerms}
            onChange={(e) => {
              const text = e.target.value;
              setWarrantyTerms(text);
              try {
                if (warrantyTermsPinned) void setUiPref(WARRANTY_TERMS_KEY, text);
              } catch {
                // ignore
              }
            }}
            placeholder="Ex: Garantia cobre defeitos de fabricação. Não cobre quedas, líquido ou mau uso."
          />

          <div className="usados-terms-actions-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={savingWarrantyTerms}
              onClick={handleToggleFixarTermosGarantia}
            >
              {warrantyTermsPinned ? 'Desfixar' : 'Fixar'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={savingWarrantyTerms}
              onClick={handleSalvarTermosGarantia}
            >
              Salvar
            </button>

            {warrantyTermsPinned ? <span className="muted">Padrão fixo</span> : null}
          </div>
        </div>
      </div>

      <div className="usados-actions">
        <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
          {saving ? '⏳ Confirmando...' : '✅ Confirmar Venda'}
        </button>
      </div>

      {errorMessage ? (
        <div className="usados-card usados-card--status usados-card--status-error">
          <strong>{errorMessage}</strong>
        </div>
      ) : null}

      {successMessage ? (
        <div className="usados-card usados-card--status usados-card--status-success">
          <strong>{successMessage}</strong>
        </div>
      ) : null}

      {vendas.length > 0 && (
        <div className="usados-card usados-card--spaced-lg">
          <h2>📋 Vendas Realizadas</h2>
          <div className="vendas-list">
            {vendasPaginadas.map((venda) => {
                const usado = usadoById.get(venda.usadoId) || null;
                const comprador = venda.compradorId ? pessoaById.get(venda.compradorId) || null : null;
                const dataVendaFmt = venda.dataVenda ? new Date(venda.dataVenda).toLocaleDateString('pt-BR') : '';
                const phone = comprador?.telefone || undefined;
                const mensagem = `Olá! Segue comprovante da venda do aparelho usado ${usado?.titulo || 'Item vendido'} - Valor: R$ ${(venda.valorVenda || 0)
                  .toFixed(2)
                  .replace('.', ',')} - Obrigado pela preferência!`;

                return (
                  <div
                    key={venda.id}
                    className="venda-historico-card"
                  >
                    <div className="venda-historico-main">
                      <strong>{usado?.titulo || 'Item vendido'}</strong>
                      <div className="venda-historico-meta">
                        {comprador?.nome || 'Comprador não identificado'} • {dataVendaFmt}
                      </div>
                      {usado?.imei ? (
                        <div className="venda-historico-imei">
                          IMEI: {usado.imei}
                        </div>
                      ) : null}
                      <div className="venda-historico-valor">
                        R$ {(venda.valorVenda || 0).toFixed(2).replace('.', ',')}
                      </div>
                    </div>

                    <div className="venda-historico-actions">
                      <PrintButton onPrint={() => handleImprimirVenda(venda, '80mm')} title="Reimprimir venda em 80mm">
                        🖨️ 80mm
                      </PrintButton>
                      <PrintButton onPrint={() => handleImprimirVenda(venda, '58mm')} title="Reimprimir venda em 58mm">
                        🖨️ 58mm
                      </PrintButton>
                      <PrintButton onPrint={() => handleImprimirVenda(venda, 'A4')} title="Reimprimir venda em A4">
                        🖨️ A4
                      </PrintButton>
                      {phone ? <WhatsAppButton telefone={phone} mensagem={mensagem} /> : null}
                      <button
                        className="btn-danger usados-danger-button"
                        onClick={() => handleDeletar(venda.id)}
                        title="Excluir venda (requer senha)"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          <Pagination
            currentPage={salesPage}
            totalPages={salesTotalPages}
            onPageChange={setSalesPage}
            canGoPrev={salesPage > 1}
            canGoNext={salesPage < salesTotalPages}
            startIndex={salesStartIndex}
            endIndex={salesEndIndex}
            totalItems={vendasOrdenadas.length}
          />
        </div>
      )}

      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={passwordPrompt.handleClose}
        onConfirm={passwordPrompt.handleConfirm}
      />
    </div>
  );
}

export default VendaUsadosPage;
