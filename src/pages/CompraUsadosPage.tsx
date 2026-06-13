import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/ToastContainer';
import { getPessoas, criarPessoa } from '@/lib/pessoas';
import { criarUsado, getUsadosEmEstoque, deletarUsado } from '@/lib/usados';
import { uploadPhoto, uploadDocument, openFileFromStorage, getUsadoStorageLabel, isLocalUsadosBucket, saveFileToDevice } from '@/lib/usados-uploads';
import { pessoasRepo, usadosArquivosRepo, usadosRepo } from '@/lib/repositories';
import { getPrimeiraFoto, gerarUrlFoto } from '@/lib/usados-fotos';
import type { Pessoa, Usado, UsadoArquivo } from '@/types';
import { isAdmin } from '@/lib/auth-supabase';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { type PrintData, printDocument } from '@/lib/print-template';
import { logger } from '@/utils/logger';
import { hydrateUiPref, readUiPrefBoolLocal, readUiPrefLocal, setUiPref } from '@/lib/ui-prefs';
import GaleriaUsados from '@/components/GaleriaUsados';
import DocumentosUsadosModal from '@/components/DocumentosUsadosModal';
import FinanceMetricsCards from '@/components/FinanceMetricsCards';
import { getMetrics, criarPeriodoPorTipo } from '@/lib/metrics';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
import Pagination from '@/components/ui/Pagination';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { printReceipt } from '@/services/print/receipt-service';
import './UsadosPages.css';

const ITEMS_PER_PAGE = 12;

function CompraUsadosPage() {
  const passwordPrompt = usePasswordPrompt();
  // Termos de compra (fixáveis) — usados no comprovante de compra e assinatura
  const purchaseTermsPinnedKey = 'smarttech:usados:purchase_terms_pinned';
  const purchaseTermsValueKey = 'smarttech:usados:purchase_terms_value';
  const DEFAULT_PURCHASE_TERMS = `TERMO DE COMPRA (USADOS)\n\nDeclaro que sou o(a) legítimo(a) proprietário(a) do aparelho descrito nesta compra e que o estou vendendo de livre e espontânea vontade.\n\nO vendedor declara estar ciente de que o aparelho poderá passar por testes e verificação de procedência.\n\nAssinatura do Vendedor: ______________________________\nAssinatura do Comprador: _____________________________\nData: ____/____/________`;

  const [purchaseTerms, setPurchaseTerms] = useState<string>(() => readUiPrefLocal(purchaseTermsValueKey, DEFAULT_PURCHASE_TERMS));
  const [purchaseTermsPinned, setPurchaseTermsPinned] = useState<boolean>(() => readUiPrefBoolLocal(purchaseTermsPinnedKey, false));

  useEffect(() => {
    void (async () => {
      const [termsRaw, pinnedRaw] = await Promise.all([
        hydrateUiPref(purchaseTermsValueKey),
        hydrateUiPref(purchaseTermsPinnedKey),
      ]);
      const nextTerms = (termsRaw ?? '').trim() || DEFAULT_PURCHASE_TERMS;
      const nextPinned = pinnedRaw === '1' || pinnedRaw === 'true';
      setPurchaseTerms(nextTerms);
      setPurchaseTermsPinned(nextPinned);
    })();
  }, []);

  useEffect(() => {
    void setUiPref(purchaseTermsValueKey, purchaseTerms);
  }, [purchaseTerms]);

  useEffect(() => {
    void setUiPref(purchaseTermsPinnedKey, purchaseTermsPinned ? '1' : '0');
  }, [purchaseTermsPinned]);

  const [usadoParaDeletar, setUsadoParaDeletar] = useState<string | null>(null);
  
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  const pessoaById = useMemo(() => {
    const m = new Map<string, Pessoa>();
    for (const p of pessoas) m.set(p.id, p);
    return m;
  }, [pessoas]);
  const [usados, setUsados] = useState<Usado[]>([]);
  const [expandedUsadoId, setExpandedUsadoId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stockSearch, setStockSearch] = useState('');

  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [sellerForm, setSellerForm] = useState({ nome: '', telefone: '', cpfCnpj: '', endereco: '' });

  const [usadoForm, setUsadoForm] = useState({
    titulo: '',
    descricao: '',
    imei: '',
    valorCompra: '',
    formaPagamento: 'dinheiro' as const
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<Usado | null>(null);
  const [filesForLast, setFilesForLast] = useState<UsadoArquivo[]>([]);
  
  // Galeria de fotos
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [usadoSelecionado, setUsadoSelecionado] = useState<Usado | null>(null);
  const [miniaturas, setMiniaturas] = useState<Map<string, string>>(new Map());
  const [photosCountByUsado, setPhotosCountByUsado] = useState<Map<string, number>>(new Map());
  const [docsCountByUsado, setDocsCountByUsado] = useState<Map<string, number>>(new Map());
  const loadedThumbIdsRef = useRef<Set<string>>(new Set());
  const isLoadingUsadosRef = useRef(false);
  const reloadUsadosPendingRef = useRef(false);
  const reloadUsadosTimerRef = useRef<number | null>(null);

  // Documentos do usado
  const [documentosAbertos, setDocumentosAbertos] = useState(false);
  const [usadoSelecionadoDocs, setUsadoSelecionadoDocs] = useState<Usado | null>(null);

  // Métricas Financeiras
  const [periodoTipo, setPeriodoTipo] = useState<'hoje' | '7dias' | 'mes' | 'personalizado'>('mes');
  const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });

  // Calcular métricas baseado no período selecionado
  const metrics = useMemo(() => {
    let periodo;
    if (periodoTipo === 'personalizado' && periodoCustom.inicio && periodoCustom.fim) {
      periodo = criarPeriodoPorTipo(periodoTipo, new Date(periodoCustom.inicio), new Date(periodoCustom.fim));
    } else if (periodoTipo === 'personalizado') {
      // Se personalizado mas sem datas, usar 'mes' como fallback
      periodo = criarPeriodoPorTipo('mes');
    } else {
      periodo = criarPeriodoPorTipo(periodoTipo);
    }
    
    return getMetrics({
      origem: 'COMPRA_USADO',
      from: periodo.inicio,
      to: periodo.fim
    });
  }, [periodoTipo, periodoCustom]);
  
  const carregarUsadosComMiniaturas = useCallback(async (reason: string = 'manual') => {
    if (isLoadingUsadosRef.current) {
      reloadUsadosPendingRef.current = true;
      return;
    }

    isLoadingUsadosRef.current = true;
    await Promise.allSettled([
      pessoasRepo.preloadLocal(),
      usadosRepo.preloadLocal(),
      usadosArquivosRepo.preloadLocal(),
    ]);

    try {
      setPessoas(getPessoas());

      const usadosEstoque = [...getUsadosEmEstoque()].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      setUsados(usadosEstoque);

      const docsCount = new Map<string, number>();
      const photosCount = new Map<string, number>();
      for (const file of usadosArquivosRepo.list()) {
        if (!file.usadoId) continue;
        if (file.kind === 'document') {
          docsCount.set(file.usadoId, (docsCount.get(file.usadoId) || 0) + 1);
        }
        if (file.kind === 'photo') {
          photosCount.set(file.usadoId, (photosCount.get(file.usadoId) || 0) + 1);
        }
      }
      setDocsCountByUsado(docsCount);
      setPhotosCountByUsado(photosCount);
    } finally {
      isLoadingUsadosRef.current = false;
      if (reloadUsadosPendingRef.current) {
        reloadUsadosPendingRef.current = false;
        window.setTimeout(() => {
          void carregarUsadosComMiniaturas('queued');
        }, 80);
      }
    }
  }, []);

  const scheduleUsadosReload = useCallback((reason: string, delay = 120) => {
    if (reloadUsadosTimerRef.current) {
      window.clearTimeout(reloadUsadosTimerRef.current);
    }
    reloadUsadosTimerRef.current = window.setTimeout(() => {
      reloadUsadosTimerRef.current = null;
      void carregarUsadosComMiniaturas(reason);
    }, delay);
  }, [carregarUsadosComMiniaturas]);

  useEffect(() => {
    void carregarUsadosComMiniaturas('mount');

    const atualizar = () => scheduleUsadosReload('event');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleUsadosReload('visible', 0);
    };

    window.addEventListener('storage', atualizar);
    window.addEventListener('smart-tech-venda-usado-criada', atualizar as any);
    window.addEventListener('smart-tech-venda-usado-deletada', atualizar as any);
    window.addEventListener('smart-tech-usado-deletado', atualizar as any);
    window.addEventListener('smarttech:sqlite-ready', atualizar as any);
    window.addEventListener('smarttech:store-changed', atualizar as any);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (reloadUsadosTimerRef.current) {
        window.clearTimeout(reloadUsadosTimerRef.current);
        reloadUsadosTimerRef.current = null;
      }
      window.removeEventListener('storage', atualizar);
      window.removeEventListener('smart-tech-venda-usado-criada', atualizar as any);
      window.removeEventListener('smart-tech-venda-usado-deletada', atualizar as any);
      window.removeEventListener('smart-tech-usado-deletado', atualizar as any);
      window.removeEventListener('smarttech:sqlite-ready', atualizar as any);
      window.removeEventListener('smarttech:store-changed', atualizar as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarUsadosComMiniaturas, scheduleUsadosReload]);
  

  const usadosFiltrados = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return usados;

    return usados.filter((u) => {
      const vendedor = u.vendedorId ? pessoaById.get(u.vendedorId) : undefined;
      return [
        u.titulo,
        u.imei,
        u.descricao,
        vendedor?.nome,
        vendedor?.telefone,
        vendedor?.cpfCnpj,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [usados, stockSearch, pessoaById]);

  const totalPages = Math.max(1, Math.ceil(usadosFiltrados.length / ITEMS_PER_PAGE));
  const usadosPaginados = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return usadosFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [usadosFiltrados, currentPage]);

  const startIndex = usadosFiltrados.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(usadosFiltrados.length, currentPage * ITEMS_PER_PAGE);

  const resumoEstoque = useMemo(() => {
    const investimentoAtual = usados.reduce((acc, usado) => acc + Number(usado.valorCompra || 0), 0);
    const totalDocumentos = Array.from(docsCountByUsado.values()).reduce((acc, total) => acc + total, 0);
    const itensComFotos = Array.from(photosCountByUsado.values()).filter((total) => total > 0).length;
    return {
      itensEmEstoque: usados.length,
      investimentoAtual,
      itensComFotos,
      totalDocumentos,
    };
  }, [usados, docsCountByUsado, photosCountByUsado]);

  const arquivosByUsado = useMemo(() => {
    const map = new Map<string, { photos: UsadoArquivo[]; documents: UsadoArquivo[] }>();
    for (const file of usadosArquivosRepo.list()) {
      if (!file.usadoId) continue;
      const current = map.get(file.usadoId) || { photos: [], documents: [] };
      if (file.kind === 'photo') current.photos.push(file);
      if (file.kind === 'document') current.documents.push(file);
      map.set(file.usadoId, current);
    }

    for (const entry of map.values()) {
      entry.photos.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      entry.documents.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    }

    return map;
  }, [usados, docsCountByUsado, photosCountByUsado]);

  useEffect(() => {
    setCurrentPage(1);
  }, [usados.length, stockSearch]);

  const limparTentativaMiniatura = useCallback((usadoId: string) => {
    for (const key of Array.from(loadedThumbIdsRef.current)) {
      if (key === usadoId || key.startsWith(`${usadoId}:`)) {
        loadedThumbIdsRef.current.delete(key);
      }
    }

    setMiniaturas((prev) => {
      const current = prev.get(usadoId);
      if (!current) return prev;
      if (current.startsWith('blob:')) URL.revokeObjectURL(current);
      const next = new Map(prev);
      next.delete(usadoId);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missing = usadosPaginados.filter((u) => {
      const photoCount = photosCountByUsado.get(u.id) || 0;
      const loadKey = `${u.id}:${photoCount}`;
      return photoCount > 0 && !miniaturas.has(u.id) && !loadedThumbIdsRef.current.has(loadKey);
    });
    if (!missing.length) return;

    missing.forEach((u) => {
      const photoCount = photosCountByUsado.get(u.id) || 0;
      loadedThumbIdsRef.current.add(`${u.id}:${photoCount}`);
    });

    void (async () => {
      const resolved: Array<[string, string]> = [];
      for (const usado of missing) {
        if (cancelled) return;
        try {
          const primeiraFoto = getPrimeiraFoto(usado.id);
          if (!primeiraFoto) continue;
          const url = await gerarUrlFoto(primeiraFoto);
          if (url) resolved.push([usado.id, url]);
        } catch {
          // ignore
        }
      }
      if (!cancelled && resolved.length) {
        setMiniaturas((prev) => {
          const next = new Map(prev);
          resolved.forEach(([id, url]) => {
            const previous = next.get(id);
            if (previous && previous !== url && previous.startsWith('blob:')) {
              URL.revokeObjectURL(previous);
            }
            next.set(id, url);
          });
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [usadosPaginados, miniaturas, photosCountByUsado]);

  const abrirGaleria = (usado: Usado) => {
    setUsadoSelecionado(usado);
    setGaleriaAberta(true);
  };

  const abrirDocumentos = (usado: Usado) => {
    setUsadoSelecionadoDocs(usado);
    setDocumentosAbertos(true);
  };

  const fecharDocumentos = () => {
    setDocumentosAbertos(false);
    setUsadoSelecionadoDocs(null);
  };
  
  const fecharGaleria = () => {
    setGaleriaAberta(false);
    setUsadoSelecionado(null);
  };

  useEffect(() => {
    if (!lastCreated) {
      setFilesForLast([]);
      return;
    }
    const items = usadosArquivosRepo.list().filter((a) => a.usadoId === lastCreated.id);
    setFilesForLast(items);
  }, [lastCreated]);

  const [online, setOnline] = useState<boolean>(isBrowserOnlineSafe());

  useEffect(() => {
    const refreshOnline = () => setOnline(isBrowserOnlineSafe());
    refreshOnline();
    window.addEventListener('online', refreshOnline);
    window.addEventListener('offline', refreshOnline);
    return () => {
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener('offline', refreshOnline);
    };
  }, []);
  const buildPrintDataFromUsado = (u: Usado): PrintData => {
    const vendedor = u.vendedorId ? pessoaById.get(u.vendedorId) : undefined;

    const obsParts: string[] = [];
    if (u.descricao) obsParts.push(u.descricao);

    const termosCompra = u.termos_compra_snapshot ?? purchaseTerms;

    return {
      tipo: 'comprovante',
      numero: u.id.slice(-6),
      clienteNome: vendedor?.nome,
      clienteTelefone: vendedor?.telefone,
      clienteEndereco: vendedor?.endereco || undefined,
      cpfCnpj: vendedor?.cpfCnpj || undefined,
      data: u.created_at,
      itens: [
        {
          nome: u.titulo + (u.imei ? ` (IMEI: ${u.imei})` : ''),
          quantidade: 1,
          preco: u.valorCompra,
        },
      ],
      valorTotal: u.valorCompra,
      formaPagamento: 'COMPRA (USADO)',
      termosCompra: termosCompra ? String(termosCompra) : undefined,
      observacoes: obsParts.length ? obsParts.join('\n\n') : undefined,
    };
  };

  const printUsado = async (u: Usado, paperSize: '58mm' | '80mm' | 'A4') => {
    if (paperSize === 'A4') {
      const printData = buildPrintDataFromUsado(u);
      printDocument(printData, { printMode: 'normal', paperSize });
      return;
    }

    await printReceipt({
      type: 'used-purchase',
      id: u.id,
      paperWidth: paperSize === '80mm' ? '80' : '58',
    });
  };

  const handleImprimirUltimoCadastro = async (paperSize: '58mm' | '80mm' | 'A4' = '80mm') => {
    if (!lastCreated) return;
    await printUsado(lastCreated, paperSize);
  };


  const handleDeletar = (id: string) => {
    setUsadoParaDeletar(id);
    passwordPrompt.requestPassword(() => executarExclusao(id));
  };

  const executarExclusao = async (id: string) => {
    try {
      const usado = usados.find(u => u.id === id);
      const sucesso = await deletarUsado(id);
      if (sucesso) {
        showToast(`✅ Compra "${usado?.titulo || 'usado'}" excluída e estornada!`, 'success');
        carregarUsadosComMiniaturas();
      } else {
        showToast('❌ Erro ao excluir compra', 'error');
      }
    } catch (error) {
      showToast('❌ Erro ao excluir compra', 'error');
    } finally {
      setUsadoParaDeletar(null);
    }
  };

  const handleSave = async () => {
    if (!usadoForm.titulo.trim()) {
      showToast('Título do usado é obrigatório.', 'warning');
      return;
    }

    setSaving(true);
    try {
      let vendedorId: string | undefined = selectedSellerId || undefined;

      if (!vendedorId) {
        if (!sellerForm.nome.trim()) {
          showToast('Nome do vendedor é obrigatório.', 'warning');
          return;
        }
        const pessoa = await criarPessoa({
          nome: sellerForm.nome,
          telefone: sellerForm.telefone || undefined,
          cpfCnpj: sellerForm.cpfCnpj || undefined,
          endereco: sellerForm.endereco || undefined
        });
        if (!pessoa) {
          showToast('Erro ao salvar vendedor.', 'error');
          return;
        }
        vendedorId = pessoa.id;
        setPessoas(getPessoas());
      }

      const usado = await criarUsado({
        vendedorId,
        titulo: usadoForm.titulo,
        descricao: usadoForm.descricao || undefined,
        imei: usadoForm.imei || undefined,
        valorCompra: Number(usadoForm.valorCompra) || 0,
        formaPagamento: usadoForm.formaPagamento || 'dinheiro',
        termos_compra_snapshot: purchaseTerms,
      });

      if (!usado) {
        showToast('Erro ao salvar usado.', 'error');
        return;
      }

      setLastCreated(usado);

      // ✅ Anexos: agora funcionam OFFLINE (IndexedDB). Mantemos feedback detalhado.
      const uploadResults = {
        photos: { success: 0, failed: 0, errors: [] as string[] },
        docs: { success: 0, failed: 0, errors: [] as string[] }
      };

      for (const f of photos) {
        try {
          await uploadPhoto(usado.id, f);
          uploadResults.photos.success++;
        } catch (err: any) {
          uploadResults.photos.failed++;
          uploadResults.photos.errors.push(f.name);
          logger.error('[Upload] Erro ao salvar foto:', err);
        }
      }

      for (const f of docs) {
        try {
          await uploadDocument(usado.id, f);
          uploadResults.docs.success++;
        } catch (err: any) {
          uploadResults.docs.failed++;
          uploadResults.docs.errors.push(f.name);
          logger.error('[Upload] Erro ao salvar documento:', err);
        }
      }

      const totalSuccess = uploadResults.photos.success + uploadResults.docs.success;
      const totalFailed = uploadResults.photos.failed + uploadResults.docs.failed;
      limparTentativaMiniatura(usado.id);
      await carregarUsadosComMiniaturas('after-upload');

      if (totalFailed === 0) {
        showToast(
          totalSuccess > 0
            ? `Compra salva! ${totalSuccess} arquivo(s) anexado(s) ${online ? '' : '(offline)'} `
            : 'Compra salva com sucesso!',
          'success'
        );
      } else {
        showToast(
          `Compra salva, mas ${totalFailed} arquivo(s) falharam. ` +
          `Falharam: ${[...uploadResults.photos.errors, ...uploadResults.docs.errors].join(', ')}`,
          'warning'
        );
      }
      
      setUsadoForm({ titulo: '', descricao: '', imei: '', valorCompra: '', formaPagamento: 'dinheiro' });
      setPhotos([]);
      setDocs([]);
      setSelectedSellerId('');
      setSellerForm({ nome: '', telefone: '', cpfCnpj: '', endereco: '' });

      // Refresh files list
      const items = usadosArquivosRepo.list().filter((a) => a.usadoId === usado.id);
      setFilesForLast(items);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar compra', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="page-container usados-page">
      <div className="page-header usados-page-header">
        <div>
          <span className="usados-page-kicker">Usados</span>
          <h1>Compra de aparelhos usados</h1>
          <p>Cadastre o aparelho, os dados do vendedor e organize anexos no mesmo fluxo.</p>
        </div>
      </div>

      {!online && (
        <div className="usados-banner-warning" role="alert">
          Você está offline. Os anexos (fotos/documentos) serão salvos no aparelho e entram no Backup.
        </div>
      )}

      <section className="usados-summary-grid">
        <div className="usados-summary-card">
          <span className="usados-summary-label">Itens em estoque</span>
          <strong className="usados-summary-value">{resumoEstoque.itensEmEstoque}</strong>
          <span className="usados-summary-helper">Aparelhos prontos para venda ou consulta.</span>
        </div>
        <div className="usados-summary-card">
          <span className="usados-summary-label">Investimento atual</span>
          <strong className="usados-summary-value">R$ {resumoEstoque.investimentoAtual.toFixed(2).replace('.', ',')}</strong>
          <span className="usados-summary-helper">Soma das compras em aberto no estoque.</span>
        </div>
        <div className="usados-summary-card">
          <span className="usados-summary-label">Cobertura documental</span>
          <strong className="usados-summary-value">{resumoEstoque.itensComFotos} com foto • {resumoEstoque.totalDocumentos} docs</strong>
          <span className="usados-summary-helper">Anexos ajudam no pós-venda e no backup local.</span>
        </div>
      </section>

      <div className="usados-grid">
        <div className="usados-card">
          <h2>Vendedor</h2>
          <div className="usados-form">
            <label className="usados-label">Nome *</label>
            <input
              className="usados-input"
              value={sellerForm.nome}
              onChange={(e) => setSellerForm((p) => ({ ...p, nome: e.target.value }))}
              disabled={saving}
              placeholder="Nome do vendedor"
            />
            <label className="usados-label">Telefone</label>
            <input
              className="usados-input"
              value={sellerForm.telefone}
              onChange={(e) => setSellerForm((p) => ({ ...p, telefone: e.target.value }))}
              disabled={saving}
              inputMode="tel"
            />
            <label className="usados-label">CPF/CNPJ</label>
            <input
              className="usados-input"
              value={sellerForm.cpfCnpj}
              onChange={(e) => setSellerForm((p) => ({ ...p, cpfCnpj: e.target.value }))}
              disabled={saving}
              inputMode="numeric"
            />
            <label className="usados-label">Endereço</label>
            <input
              className="usados-input"
              value={sellerForm.endereco}
              onChange={(e) => setSellerForm((p) => ({ ...p, endereco: e.target.value }))}
              disabled={saving}
            />
          </div>
        </div>

        <div className="usados-card">
          <h2>Aparelho usado</h2>
          <label className="usados-label">Título *</label>
          <input
            className="usados-input"
            value={usadoForm.titulo}
            onChange={(e) => setUsadoForm((p) => ({ ...p, titulo: e.target.value }))}
            disabled={saving}
            placeholder="Ex: iPhone 11 64GB"
          />
          <label className="usados-label">IMEI</label>
          <input
            className="usados-input"
            value={usadoForm.imei}
            onChange={(e) => setUsadoForm((p) => ({ ...p, imei: e.target.value }))}
            disabled={saving}
            placeholder="Opcional"
          />
          <label className="usados-label">Descrição</label>
          <textarea
            className="usados-textarea"
            value={usadoForm.descricao}
            onChange={(e) => setUsadoForm((p) => ({ ...p, descricao: e.target.value }))}
            disabled={saving}
            rows={4}
            placeholder="Condição do aparelho, detalhes..."
          />
          <label className="usados-label">Valor de compra (R$)</label>
          <input
            className="usados-input"
            type="number"
            min="0"
            step="0.01"
            value={usadoForm.valorCompra}
            onChange={(e) => setUsadoForm((p) => ({ ...p, valorCompra: e.target.value }))}
            disabled={saving}
            inputMode="decimal"
          />
          <label className="usados-label">Forma de pagamento *</label>
          <select
            className="usados-input"
            value={usadoForm.formaPagamento}
            onChange={(e) => setUsadoForm((p) => ({ ...p, formaPagamento: e.target.value as any }))}
            disabled={saving}
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="boleto">Boleto</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div className="usados-card">
          <h2>Fotos do aparelho</h2>
          <input
            className="usados-input"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const MAX_SIZE = 10 * 1024 * 1024; // 10MB
              const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
              
              const validFiles = files.filter(f => {
                if (f.size > MAX_SIZE) {
                  showToast(`❌ "${f.name}" muito grande (máx: 10MB)`, 'error');
                  return false;
                }
                if (!ALLOWED_TYPES.includes(f.type)) {
                  showToast(`❌ "${f.name}" não é uma imagem válida`, 'error');
                  return false;
                }
                return true;
              });
              
              if (validFiles.length > 0) {
                setPhotos(prev => [...prev, ...validFiles]);
                showToast(`✅ ${validFiles.length} foto(s) adicionada(s)`, 'success');
              }
              e.target.value = ''; // Limpar input
            }}
            disabled={saving}
          />
          <div className="usados-hint">
            Dica: no celular, você pode abrir a câmera diretamente. Máximo: 10MB por foto.
          </div>
          {photos.length > 0 && (
            <ul className="usados-file-list">
              {photos.map((f) => (
                <li key={f.name}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)}MB)</li>
              ))}
            </ul>
          )}
        </div>

        <div className="usados-card">
          <h2>Documentos</h2>
          <input
            className="usados-input"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const MAX_SIZE = 10 * 1024 * 1024; // 10MB
              const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
              
              const validFiles = files.filter(f => {
                if (f.size > MAX_SIZE) {
                  showToast(`❌ "${f.name}" muito grande (máx: 10MB)`, 'error');
                  return false;
                }
                if (!ALLOWED_TYPES.includes(f.type)) {
                  showToast(`❌ "${f.name}" deve ser PDF, JPG ou PNG`, 'error');
                  return false;
                }
                return true;
              });
              
              if (validFiles.length > 0) {
                setDocs(prev => [...prev, ...validFiles]);
                showToast(`✅ ${validFiles.length} documento(s) adicionado(s)`, 'success');
              }
              e.target.value = ''; // Limpar input
            }}
            disabled={saving}
          />
          {docs.length > 0 && (
            <ul className="usados-file-list">
              {docs.map((f) => (
                <li key={f.name}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)}MB)</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      
      <div className="usados-card usados-card--spaced">
        <div className="usados-terms-header">
          <div>
            <h2>Termos de compra</h2>
            <p className="usados-muted usados-inline-note">
              Isso sai impresso junto com os dados do aparelho e uma linha de assinatura.
            </p>
          </div>

          <div className="usados-terms-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const newPinned = !purchaseTermsPinned;
                void setUiPref(purchaseTermsPinnedKey, newPinned ? '1' : '0');
                void setUiPref(purchaseTermsValueKey, purchaseTerms || '');
                setPurchaseTermsPinned(newPinned);
              }}
              title={purchaseTermsPinned ? 'Desfixar termos' : 'Fixar termos como padrão'}
            >
              {purchaseTermsPinned ? 'Desfixar padrão' : 'Fixar como padrão'}
            </button>

            {purchaseTermsPinned && <span className="usados-badge">Padrão ativo</span>}
          </div>
        </div>

        <div className="usados-section-block">
          <label className="usados-label">Termos de compra</label>
          <textarea
            className="usados-textarea usados-terms-textarea"
            rows={8}
            value={purchaseTerms}
            onChange={(e) => setPurchaseTerms(e.target.value)}
            disabled={purchaseTermsPinned}
            placeholder="Ex.: Declaro que sou o(a) legítimo(a) proprietário(a) do aparelho descrito acima e autorizo a avaliação/compra nas condições informadas."
          />
        </div>

        <div className="usados-terms-footer">
          <small className="usados-muted">
            Dica: deixe termos curtos e claros para um comprovante mais profissional.
          </small>
        </div>
      </div>

<div className="usados-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando compra...' : 'Salvar compra'}
        </button>
      </div>

      {lastCreated && (
        <div className="usados-card usados-card--spaced">
          <h2>Último cadastro</h2>
          <p>
            <strong>{lastCreated.titulo}</strong> — <code>{lastCreated.id.slice(0, 8)}...</code>
          </p>
          <div className="usados-last-actions">
            <button className="btn-secondary usados-inline-button" onClick={() => handleImprimirUltimoCadastro('80mm')}>
              Imprimir 80mm
            </button>
            <button className="btn-secondary usados-inline-button" onClick={() => handleImprimirUltimoCadastro('58mm')}>
              Imprimir 58mm
            </button>
            <button className="btn-secondary usados-inline-button" onClick={() => handleImprimirUltimoCadastro('A4')}>
              Imprimir A4
            </button>{lastCreated.vendedorId && (() => {
              const vendedor = pessoas.find(p => p.id === lastCreated.vendedorId);
              if (vendedor?.telefone) {
                return (
                  <WhatsAppButton
                    telefone={vendedor.telefone}
                    mensagem={`Olá! Recebemos o aparelho ${lastCreated.titulo}${lastCreated.imei ? ` (IMEI: ${lastCreated.imei})` : ''} - Valor: R$ ${lastCreated.valorCompra.toFixed(2).replace('.', ',')} - Obrigado!`}
                  />
                );
              }
              return null;
            })()}
          </div>
          <h3 className="usados-section-title">Arquivos</h3>
          {filesForLast.length === 0 ? (
            <p className="usados-hint">Nenhum arquivo cadastrado.</p>
          ) : (
            <ul className="usados-file-list">
              {filesForLast.map((a) => (
                <li key={a.id} className="usados-file-row">
                  <span className="usados-file-main">
                    <span>
                      {a.kind === 'photo' ? 'Foto' : 'Documento'} • {a.originalName || a.path}
                    </span>
                    <span
                      className={`usados-file-badge ${isLocalUsadosBucket(a.bucket) ? 'is-local' : 'is-remote'}`}
                      title={isLocalUsadosBucket(a.bucket) ? 'Arquivo salvo apenas no armazenamento local/offline e coberto pelo backup.' : 'Arquivo salvo no Supabase Storage da loja.'}
                    >
                      {getUsadoStorageLabel(a.bucket)}
                    </span>
                  </span>
                  <button
                    className="btn-secondary"
                    onClick={() => openFileFromStorage(a.bucket, a.path, a.originalName || undefined)}
                    disabled={saving || (!online && a.bucket !== '__local__')}
                  >
                    Abrir
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => void saveFileToDevice(a.bucket, a.path, a.originalName || undefined)}
                    disabled={saving || (!online && a.bucket !== '__local__')}
                  >
                    Baixar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="usados-card usados-card--spaced">
        <h2>Em estoque</h2>
        {usados.length > 0 && (
          <div className="usados-stock-toolbar">
            <label className="usados-label usados-stock-search">
              <span>Buscar no estoque</span>
              <input
                className="usados-input"
                value={stockSearch}
                onChange={(event) => setStockSearch(event.target.value)}
                placeholder="Modelo, IMEI, vendedor, telefone..."
              />
            </label>
            <span className="usados-stock-count">
              {usadosFiltrados.length} de {usados.length} item(ns)
            </span>
          </div>
        )}
        {usados.length === 0 ? (
          <p className="usados-hint">Nenhum usado em estoque.</p>
        ) : usadosFiltrados.length === 0 ? (
          <p className="usados-hint">Nenhum usado encontrado para esta busca.</p>
        ) : (
          <div className="usados-estoque-grid">
            {usadosPaginados.map((u) => {
              const numFotos = photosCountByUsado.get(u.id) || 0;
              const numDocs = docsCountByUsado.get(u.id) || 0;
              const arquivos = arquivosByUsado.get(u.id) || { photos: [], documents: [] };
              const primeiraFotoArquivo = arquivos.photos[0];
              const primeiroDocumentoArquivo = arquivos.documents[0];
              const miniatura = miniaturas.get(u.id);
              
              return (
                <div key={u.id} className="usado-estoque-card">
                  {/* Miniatura */}
                  <div className="usado-miniatura">
                    {miniatura ? (
                      <img 
                        src={miniatura} 
                        alt={u.titulo}
                        className="usado-miniatura-img"
                      />
                    ) : (
                      <div className="usado-miniatura-placeholder">
                        ST
                      </div>
                    )}
                  </div>
                  
                  {/* Informações */}
                  <div className="usado-info">
                    <h4>{u.titulo}</h4>
                    <p className="usado-imei">{u.imei || 'IMEI não informado'}</p>
                    <p className="usado-valor">
                      R$ {u.valorCompra.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  
                  {/* Botões */}
                  <div className="usados-stock-actions">
                    {primeiraFotoArquivo && (
                      <div className="usados-stock-file-row">
                        <button
                          type="button"
                          className="btn-secondary usados-stock-inline-btn"
                          onClick={() => abrirGaleria(u)}
                          disabled={saving || (!online && primeiraFotoArquivo.bucket !== '__local__')}
                        >
                          Ver fotos ({numFotos})
                        </button>
                        <button
                          type="button"
                          className="btn-secondary usados-stock-inline-btn"
                          onClick={() => void saveFileToDevice(primeiraFotoArquivo.bucket, primeiraFotoArquivo.path, primeiraFotoArquivo.originalName || undefined)}
                          disabled={saving || (!online && primeiraFotoArquivo.bucket !== '__local__')}
                        >
                          Baixar foto
                        </button>
                      </div>
                    )}
                    {primeiroDocumentoArquivo && (
                      <div className="usados-stock-file-row">
                        <button
                          type="button"
                          className="btn-secondary usados-stock-inline-btn"
                          onClick={() => abrirDocumentos(u)}
                          disabled={saving || (!online && primeiroDocumentoArquivo.bucket !== '__local__')}
                        >
                          Ver documentos ({numDocs})
                        </button>
                        <button
                          type="button"
                          className="btn-secondary usados-stock-inline-btn"
                          onClick={() => void saveFileToDevice(primeiroDocumentoArquivo.bucket, primeiroDocumentoArquivo.path, primeiroDocumentoArquivo.originalName || undefined)}
                          disabled={saving || (!online && primeiroDocumentoArquivo.bucket !== '__local__')}
                        >
                          Baixar doc
                        </button>
                      </div>
                    )}

                    
                    <button
                      type="button"


                    
                      className="btn-ver-docs usados-action-button"
                      onClick={() => printUsado(u, '80mm')}


                    
                      title="Imprimir recibo 80mm"


                    
                    >


                    
                      Imprimir 80mm


                    
                    </button>



                    
                    <button
                      type="button"


                    
                      className="btn-ver-docs usados-action-button"
                      onClick={() => printUsado(u, '58mm')}


                    
                      title="Imprimir recibo 58mm"


                    
                    >


                    
                      Imprimir 58mm


                    
                    </button>


                    <button
                      type="button"



                      className="btn-ver-docs usados-action-button"
                      onClick={() => printUsado(u, 'A4')}



                      title="Imprimir A4"



                    >



                      Imprimir A4



                    </button>



                    
                    <button
                      type="button"


                    
                      className="btn-danger usados-danger-button"
                      onClick={() => handleDeletar(u.id)}
                      title="Excluir compra (requer senha)"
                    >
                      Excluir
                    </button>
                  </div>
                  
                  {numFotos === 0 && (
                    <span className="usado-sem-fotos">Sem fotos</span>
                  )}
                </div>
              );
            })}
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
          totalItems={usadosFiltrados.length}
        />
      </div>
      
      {/* Galeria de Fotos */}
      {usadoSelecionado && (
        <GaleriaUsados
          usadoId={usadoSelecionado.id}
          titulo={usadoSelecionado.titulo}
          isOpen={galeriaAberta}
          onClose={fecharGaleria}
        />
      )}

      {/* Documentos do Usado */}
      {usadoSelecionadoDocs && (
        <DocumentosUsadosModal
          usadoId={usadoSelecionadoDocs.id}
          titulo={usadoSelecionadoDocs.titulo}
          isOpen={documentosAbertos}
          onClose={fecharDocumentos}
        />
      )}

      {/* Prompt de Senha */}
      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={passwordPrompt.handleClose}
        onConfirm={passwordPrompt.handleConfirm}
      />
    </div>
  );
}

export default CompraUsadosPage;
