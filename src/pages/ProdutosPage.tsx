import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { List } from 'react-window';
import { Produto } from '@/types';
import { getProdutos, criarProduto, atualizarProduto, deletarProduto } from '@/lib/produtos';
import { produtosRepo } from '@/lib/repositories';
import { canCreate, canEdit, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Pagination from '@/components/ui/Pagination';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import { showToast } from '@/components/ui/ToastContainer';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/utils/logger';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';
import { useSmartForm } from '@/hooks/useSmartForm';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { getPinnedProductIds, togglePinnedProduct } from '@/lib/pinned-products';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import './ProdutosPage.css';

const PRODUCT_PHOTO_MAX_SIZE = 8 * 1024 * 1024;
const PRODUCT_PHOTO_MAX_DIMENSION = 720;

function getProdutoFoto(produto: Produto | null | undefined): string {
  const foto = String(produto?.fotoDataUrl || '').trim();
  return foto.startsWith('data:image/') ? foto : '';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Imagem inválida'));
    image.src = dataUrl;
  });
}

async function compactProductPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione uma imagem válida.');
  }
  if (file.size > PRODUCT_PHOTO_MAX_SIZE) {
    throw new Error('A foto deve ter no máximo 8MB.');
  }

  const raw = await readFileAsDataUrl(file);
  const image = await loadImage(raw);
  const scale = Math.min(PRODUCT_PHOTO_MAX_DIMENSION / image.width, PRODUCT_PHOTO_MAX_DIMENSION / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a foto.');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.84);
}

function ProdutosPage() {
  // ✅ Passo 5: manter base separada para evitar buscar no Repository a cada tecla
  const [allProdutos, setAllProdutos] = useState<Produto[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>(getPinnedProductIds());
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<boolean | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Patch 10: Modo rápido (⚡) – virtualizado (bom para bases grandes)
  const FAST_MODE_KEY = 'smart-tech:produtos:fast-mode';
  const [fastMode, setFastMode] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(FAST_MODE_KEY);
      if (v === null) {
        localStorage.setItem(FAST_MODE_KEY, '1');
        return true; // padrão ON
      }
      return v === '1';
    } catch {
      return true;
    }
  });

  const [fastHeight, setFastHeight] = useState<number>(() => {
    try {
      return Math.max(360, Math.min(760, window.innerHeight - 320));
    } catch {
      return 520;
    }
  });
  const initialForm = {
    nome: '',
    descricao: '',
    preco: '',
    custo: '',
    estoque: '',
    codigoBarras: '',
    categoria: '',
    fotoDataUrl: '',
    ativo: true
  };

  const { formData, setFormData, clearDraft, resetForm, hasDraft } = useSmartForm({
    formKey: 'produtos',
    initialValues: initialForm
  });

  const debouncedBusca = useDebounce(busca, 300);
  const debouncedCodigo = useDebounce(formData.codigoBarras, 300);

  // Ajustar altura do list virtualizado ao redimensionar (throttle p/ evitar jank)
  useEffect(() => {
    try {
      let raf = 0;
      let t: any = null;
      const onResize = () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            setFastHeight(Math.max(360, Math.min(760, window.innerHeight - 320)));
          });
        }, 120);
      };
      window.addEventListener('resize', onResize);
      return () => {
        if (t) clearTimeout(t);
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      };
    } catch {
      return;
    }
  }, []);

  // Índice de busca leve (recalcula só quando a base muda)
  const searchIndex = useMemo(() => {
    return allProdutos.map((p) => {
      const key = `${p.nome || ''} ${p.codigoBarras || ''} ${p.categoria || ''} ${p.descricao || ''}`.toLowerCase();
      return { id: p.id, key };
    });
  }, [allProdutos]);

  // Auto-sugestão: ao digitar código de barras, sugerir produto existente
  useEffect(() => {
    if (produtoEditando) return;
    const codigo = (debouncedCodigo || '').replace(/\D/g, '');
    if (codigo.length < 8) return;
    if (formData.nome?.trim()) return;

    const existente = getProdutos().find(p => (p.codigoBarras || '').replace(/\D/g, '') === codigo);
    if (existente) {
      setFormData((prev) => ({
        ...prev,
        nome: existente.nome,
        descricao: existente.descricao || prev.descricao,
        preco: existente.preco?.toString?.() || prev.preco,
        custo: existente.custo?.toString?.() || prev.custo,
        categoria: existente.categoria || prev.categoria,
        // manter codigoBarras digitado pelo usuário
        codigoBarras: prev.codigoBarras
      }));
      showToast('Produto já existe! Dados sugeridos automaticamente.', 'info');
    }
  }, [debouncedCodigo, produtoEditando]);

  const refreshProdutosBase = useCallback(() => {
    const base = getProdutos();
    setAllProdutos(base);
    setPinnedIds(getPinnedProductIds());

    logger.diagnosticOnce?.(`produtos-base-recarregada:${base.length}`, '[ProdutosPage] Base recarregada:', { total: base.length });
  }, []);

  const produtos = useMemo(() => {
    const buscaAtual = debouncedBusca.trim().toLowerCase();
    let produtosFiltrados = allProdutos;

    if (buscaAtual) {
      const allow = new Set(searchIndex.filter((x) => x.key.includes(buscaAtual)).map((x) => x.id));
      produtosFiltrados = allProdutos.filter((p) => allow.has(p.id));
    }

    if (filtroAtivo !== null) {
      produtosFiltrados = produtosFiltrados.filter((p) => p.ativo === filtroAtivo);
    }

    return produtosFiltrados;
  }, [allProdutos, debouncedBusca, filtroAtivo, searchIndex]);

  // Carregar produtos ao montar componente
  useEffect(() => {
    try { perfMarkOnce('screen_mounted:produtos'); } catch {}
    logger.diagnosticOnce?.('produtos-page-mount', '[ProdutosPage] Carregando produtos ao montar componente');
    refreshProdutosBase();

    try {
      requestAnimationFrame(() => {
        perfMarkOnce('screen_ready:produtos');
        perfMeasure('private_shell→produtos', 'private_shell', 'screen_ready:produtos');
      });
    } catch {
      // ignore
    }
  }, [refreshProdutosBase]);

  useEffect(() => {
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshProdutosBase();
      }, 120);
    };

    const onStorage = () => {
      scheduleRefresh();
    };
    
    const onProdutoChange = () => {
      scheduleRefresh();
    };
    
    // Escutar eventos de storage (outras abas)
    window.addEventListener('storage', onStorage);
    // Escutar eventos customizados (mesma aba)
    window.addEventListener('smart-tech-produto-criado', onProdutoChange);
    window.addEventListener('smart-tech-produto-atualizado', onProdutoChange);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('smart-tech-produto-criado', onProdutoChange);
      window.removeEventListener('smart-tech-produto-atualizado', onProdutoChange);
    };
  }, [refreshProdutosBase]);

  const carregarProdutos = () => {
    refreshProdutosBase();
  };

  // Paginação
  const pagination = usePagination(produtos, { itemsPerPage: 20 });

  const toggleFastMode = useCallback(() => {
    setFastMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FAST_MODE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);


  const setFastModeValue = useCallback((next: boolean) => {
    setFastMode((prev) => {
      if (prev === next) return prev;
      try {
        localStorage.setItem(FAST_MODE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const limparForm = () => {
    setProdutoEditando(null);
    setMostrarForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!formData.nome.trim()) {
      showToast('Nome do produto é obrigatório', 'error');
      return;
    }

    const preco = parseFloat(formData.preco);
    if (isNaN(preco) || preco < 0) {
      showToast('Preço inválido. Deve ser um número maior ou igual a zero', 'error');
      return;
    }

    if (formData.custo) {
      const custo = parseFloat(formData.custo);
      if (isNaN(custo) || custo < 0) {
        showToast('Custo inválido. Deve ser um número maior ou igual a zero', 'error');
        return;
      }
    }

    const estoque = parseInt(formData.estoque);
    if (isNaN(estoque) || estoque < 0) {
      showToast('Estoque inválido. Deve ser um número inteiro maior ou igual a zero', 'error');
      return;
    }

    if (formData.codigoBarras && formData.codigoBarras.trim().length > 0) {
      // Validar código de barras (apenas números, 8 ou 13 dígitos)
      const codigoLimpo = formData.codigoBarras.replace(/\D/g, '');
      if (codigoLimpo.length !== 8 && codigoLimpo.length !== 13 && codigoLimpo.length !== 12) {
        showToast('Código de barras inválido. Deve ter 8, 12 ou 13 dígitos', 'error');
        return;
      }
    }
    
    const produtoData = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || undefined,
      preco: preco,
      custo: formData.custo ? parseFloat(formData.custo) : undefined,
      estoque: estoque,
      codigoBarras: formData.codigoBarras.trim() || undefined,
      categoria: formData.categoria.trim() || undefined,
      fotoDataUrl: formData.fotoDataUrl || undefined,
      ativo: formData.ativo
    };
    
    let resultado: Produto | null = null;
    
    if (produtoEditando) {
      resultado = await atualizarProduto(produtoEditando.id, produtoData);
      if (resultado) {
        showToast('Produto atualizado com sucesso!', 'success');
      } else {
        showToast('Erro ao atualizar produto. Verifique os dados e tente novamente.', 'error');
        return;
      }
    } else {
      if (import.meta.env.DEV) {
        logger.log('[ProdutosPage] Criando produto com payload:', produtoData);
      }
      
      resultado = await criarProduto(produtoData);
      
      if (resultado) {
        if (import.meta.env.DEV) {
          logger.log('[ProdutosPage] Produto criado com sucesso:', {
            id: resultado.id,
            nome: resultado.nome,
            ativo: resultado.ativo
          });
        }
        
        // Se produto foi criado como inativo e filtro está em "Ativos", limpar filtro
        if (!resultado.ativo && filtroAtivo === true) {
          if (import.meta.env.DEV) {
            logger.log('[ProdutosPage] Produto criado como inativo, mas filtro está em "Ativos". Limpando filtro para mostrar o produto.');
          }
          setFiltroAtivo(null);
        }
        
        showToast('Produto criado com sucesso!', 'success');
      } else {
        logger.error('[ProdutosPage] Erro ao criar produto');
        showToast('Erro ao criar produto. Verifique os dados e tente novamente.', 'error');
        return;
      }
    }
    
    // Recarregar produtos após salvar
    // O produto já foi salvo no LocalStorage pelo Repository
    // Apenas precisamos recarregar a lista aplicando os filtros
    // Após salvar: limpar rascunho e fechar
    resetForm();
    clearDraft();
    limparForm();
    
    // Aguardar um pouco para garantir que o estado foi atualizado
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Recarregar base após salvar
    refreshProdutosBase();
    
    // Verificar se o produto aparece na lista (debug em DEV)
    if (import.meta.env.DEV && resultado) {
      // Aguardar mais um pouco para garantir que a lista foi atualizada
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const produtosAposRecarregar = getProdutos();
      const produtoEncontrado = produtosAposRecarregar.find(p => p.id === resultado.id);
      
      if (!produtoEncontrado) {
        logger.warn('[ProdutosPage] ⚠️ Produto criado mas não encontrado após recarregar:', {
          produtoId: resultado.id,
          produtoNome: resultado.nome,
          produtoAtivo: resultado.ativo,
          totalProdutos: produtosAposRecarregar.length,
          filtroAtivo: filtroAtivo,
          busca: debouncedBusca,
          produtosNoRepo: produtosRepo.list().length,
          produtoNoRepo: produtosRepo.getById(resultado.id) ? 'SIM' : 'NÃO'
        });
        
        // Tentar recarregar novamente
        setTimeout(() => {
          refreshProdutosBase();
        }, 100);
      } else {
        logger.log('[ProdutosPage] ✅ Produto encontrado após recarregar:', {
          produtoId: resultado.id,
          produtoNome: resultado.nome
        });
      }
    }
  };

  const handleEditar = (produto: Produto) => {
    setProdutoEditando(produto);
    setFormData(() => ({
      nome: produto.nome,
      descricao: produto.descricao || '',
      preco: produto.preco.toString(),
      custo: produto.custo?.toString() || '',
      estoque: produto.estoque.toString(),
      codigoBarras: produto.codigoBarras || '',
      categoria: produto.categoria || '',
      fotoDataUrl: getProdutoFoto(produto),
      ativo: produto.ativo
    }));
    setMostrarForm(true);
  };

  const handleFotoProduto = async (file: File | null) => {
    if (readOnly || !file) return;
    try {
      const fotoDataUrl = await compactProductPhoto(file);
      setFormData((prev) => ({ ...prev, fotoDataUrl }));
      showToast('Foto do produto adicionada.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar foto do produto.', 'error');
    }
  };

  const openProductPhotoPreview = useCallback((produto: Produto) => {
    const foto = getProdutoFoto(produto);
    if (!foto) return;
    setPhotoPreview({ src: foto, name: produto.nome || 'Produto' });
  }, []);

  const handleDeletar = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      const sucesso = await deletarProduto(id);
      if (sucesso) {
        showToast('Produto excluído com sucesso!', 'success');
        carregarProdutos();
      } else {
        showToast('Erro ao excluir produto.', 'error');
      }
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const readOnly = isReadOnlyMode();
  const canCreateProd = canCreate() && !readOnly;
  const canEditProd = canEdit() && !readOnly;
  const canDeleteProd = canDelete() && !readOnly;

  // Patch 10: props estáveis para o List virtualizado
  const fastRowProps = useMemo(() => {
    return {
      items: produtos,
      pinnedIds,
      canEditProd,
      canDeleteProd,
      onEdit: handleEditar,
      onDelete: handleDeletar,
      onPreviewPhoto: openProductPhotoPreview,
      onTogglePin: (id: string) => {
        const result = togglePinnedProduct(id);
        setPinnedIds(result.ids);
        showToast(result.pinned ? '📌 Produto fixado para venda rápida' : '📌 Produto removido dos fixados', 'success');
      },
      formatCurrency
    };
  }, [produtos, pinnedIds, canEditProd, canDeleteProd, openProductPhotoPreview]);

  const ProdutoRow = useCallback((props: any) => {
    const { index, style, items, pinnedIds, canEditProd, canDeleteProd, onEdit, onDelete, onTogglePin, onPreviewPhoto, formatCurrency } = props;
    const produto: Produto | undefined = items?.[index];
    if (!produto) return null;
    const pinned = pinnedIds?.includes(produto.id);
    const foto = getProdutoFoto(produto);

    return (
      <div style={style} className={`produto-fast-row ${produto.ativo ? '' : 'inativo'}`}>
        <button
          className={`btn-icon ${pinned ? 'pinned' : ''}`}
          title={pinned ? 'Desfixar' : 'Fixar'}
          onClick={() => onTogglePin(produto.id)}
        >
          {pinned ? '📌' : '📍'}
        </button>

        {foto ? (
          <button
            type="button"
            className="produto-thumb produto-thumb--fast produto-thumb-button has-photo"
            onClick={() => onPreviewPhoto(produto)}
            aria-label={`Abrir foto de ${produto.nome}`}
            title="Abrir foto"
          >
            <img src={foto} alt={`Foto de ${produto.nome}`} loading="lazy" />
          </button>
        ) : (
          <div className="produto-thumb produto-thumb--fast">
            <span>ST</span>
          </div>
        )}

        <div className="produto-fast-main">
          <div className="produto-fast-title">
            <strong>{produto.nome}</strong>
            {produto.categoria && <span className="produto-fast-chip">{produto.categoria}</span>}
          </div>
          <div className="produto-fast-sub">
            <span>Preço: {formatCurrency(produto.preco)}</span>
            <span>Estoque: {produto.estoque}</span>
            <span>{produto.ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>

        <div className="produto-fast-actions">
          {canEditProd && (
            <button className="btn-secondary" onClick={() => onEdit(produto)}>
              Editar
            </button>
          )}
          {canDeleteProd && (
            <button className="btn-secondary danger" onClick={() => onDelete(produto.id)}>
              Excluir
            </button>
          )}
        </div>
      </div>
    );
  }, []);

  return (
    <div className="produtos-page page-container">
      <ReadOnlyBanner />
      <PageHeader
        kicker="Catálogo e estoque"
        title="Produtos"
        subtitle="Cadastre, consulte e gerencie o estoque de produtos."
        actions={
          <Guard
            allowed={canCreateProd}
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
              Novo produto
            </button>
          </Guard>
        }
      >

        <PageToolbar
          left={
            <div className="filters-bar" style={{ marginTop: 0, padding: 0, border: 0, background: 'transparent' }}>
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
          }
          right={
            <div className="produtos-toolbar-right">
              <SegmentedControl
                ariaLabel="Filtrar produtos"
                value={filtroAtivo === null ? 'all' : (filtroAtivo ? 'active' : 'inactive')}
                onChange={(v) => {
                  if (v === 'all') setFiltroAtivo(null);
                  else if (v === 'active') setFiltroAtivo(true);
                  else if (v === 'inactive') setFiltroAtivo(false);
                }}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Ativos' },
                  { value: 'inactive', label: 'Inativos' },
                ]}
              />

              <SegmentedControl
                ariaLabel="Modo de visualização"
                value={fastMode ? 'fast' : 'normal'}
                onChange={(v) => setFastModeValue(v === 'fast')}
                size="sm"
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'fast', label: 'Rápido', title: 'Modo rápido (virtualizado)' },
                ]}
              />
            </div>
          }
        />
      </PageHeader>

      <Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title={produtoEditando ? 'Editar Produto' : 'Novo Produto'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="standard-form">
          {hasDraft && !produtoEditando && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  clearDraft();
                  resetForm();
                  showToast('Rascunho limpo.', 'success');
                }}
                disabled={readOnly}
              >
                Limpar rascunho
              </button>
            </div>
          )}
          <div className="form-grid">
            <FormField label="Nome" required fullWidth>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="form-input"
                readOnly={readOnly}
                autoFocus
              />
            </FormField>
            <FormField label="Descrição" fullWidth>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
                className="form-textarea"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Preço de Venda" required>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.preco}
                onChange={(e) => {
                  if (readOnly) return;
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFormData({ ...formData, preco: value });
                  }
                }}
                className="form-input"
                placeholder="0.00"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Custo">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.custo}
                onChange={(e) => {
                  if (readOnly) return;
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFormData({ ...formData, custo: value });
                  }
                }}
                className="form-input"
                placeholder="0.00"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Estoque" required>
              <input
                type="number"
                min="0"
                required
                value={formData.estoque}
                onChange={(e) => {
                  if (readOnly) return;
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) >= 0)) {
                    setFormData({ ...formData, estoque: value });
                  }
                }}
                className="form-input"
                placeholder="0"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Código de Barras">
              <MaskedInput
                value={formData.codigoBarras}
                onChange={(value) => {
                  if (readOnly) return;
                  const digits = value.replace(/\D/g, '').slice(0, 13);
                  setFormData({ ...formData, codigoBarras: digits });
                }}
                className="form-input"
                placeholder="Apenas números (8, 12 ou 13 dígitos)"
                readOnly={readOnly}
                inputMode="numeric"
              />
            </FormField>
            <FormField label="Categoria">
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="form-input"
                readOnly={readOnly}
              />
            </FormField>
            <FormField label="Foto do produto" fullWidth>
              <div className="produto-photo-field">
                <div className={`produto-photo-preview ${formData.fotoDataUrl ? 'has-photo' : ''}`}>
                  {formData.fotoDataUrl ? (
                    <img src={formData.fotoDataUrl} alt="Prévia da foto do produto" />
                  ) : (
                    <span>Sem foto</span>
                  )}
                </div>
                <div className="produto-photo-actions">
                  <label className={`btn-secondary produto-photo-button ${readOnly ? 'disabled' : ''}`}>
                    Adicionar foto
                    <input
                      type="file"
                      accept="image/*"
                      disabled={readOnly}
                      onClick={(event) => {
                        event.currentTarget.value = '';
                      }}
                      onChange={(event) => {
                        void handleFotoProduto(event.target.files?.[0] || null);
                      }}
                    />
                  </label>
                  {formData.fotoDataUrl && (
                    <button
                      type="button"
                      className="btn-secondary danger"
                      disabled={readOnly}
                      onClick={() => setFormData({ ...formData, fotoDataUrl: '' })}
                    >
                      Remover foto
                    </button>
                  )}
                  <span className="produto-photo-hint">JPG/PNG/WebP até 8MB. A imagem é reduzida automaticamente.</span>
                </div>
              </div>
            </FormField>
            <FormField label="Status">
              <select
                value={formData.ativo ? 'ativo' : 'inativo'}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.value === 'ativo' })}
                className="form-input"
                disabled={readOnly}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </FormField>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={limparForm}>
              Cancelar
            </button>
            <Guard 
              allowed={produtoEditando ? canEditProd : canCreateProd}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : produtoEditando ? 'Sem permissão para editar' : 'Sem permissão para criar'}
            >
              <button type="submit" className="btn-primary">
                {readOnly ? 'Modo leitura (licença expirada)' : produtoEditando ? 'Salvar' : 'Criar'}
              </button>
            </Guard>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(photoPreview)}
        onClose={() => setPhotoPreview(null)}
        title={photoPreview ? photoPreview.name : 'Foto do produto'}
        size="lg"
      >
        {photoPreview ? (
          <div className="produto-photo-preview-modal">
            <img src={photoPreview.src} alt={`Foto ampliada de ${photoPreview.name}`} />
          </div>
        ) : null}
      </Modal>

      {/* Toolbar movida para o header para reduzir poluição */}

      {fastMode ? (
        <div className="produtos-fast">
          {produtos.length === 0 ? (
            <EmptyState
              icon="📦"
              title="Nenhum produto encontrado"
              message="Tente limpar a busca/filtros ou cadastre um novo produto."
              actionsSlot={
                <div className="produtos-empty-actions">
                  <Guard
                    allowed={canCreateProd}
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
                      Novo produto
                    </button>
                  </Guard>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setBusca('');
                      setFiltroAtivo(null);
                    }}
                  >
                    Limpar busca/filtros
                  </button>
                </div>
              }
            />
          ) : (
            <>
              <div className="produto-fast-header">
                <span className="produto-fast-col pin">📌</span>
                <span className="produto-fast-col main">Produto</span>
                <span className="produto-fast-col actions">Ações</span>
              </div>
              <List
                rowComponent={ProdutoRow}
                rowCount={produtos.length}
                rowHeight={64}
                rowProps={fastRowProps}
                overscanCount={8}
                style={{ height: fastHeight, width: '100%' }}
                className="produto-fast-list"
              />
            </>
          )}
        </div>
      ) : (
        <div className="produtos-grid">
          {pagination.paginatedItems.length === 0 ? (
            <EmptyState
              icon="📦"
              title="Nenhum produto encontrado"
              message="Tente limpar a busca/filtros ou cadastre um novo produto."
              actionsSlot={
                <div className="produtos-empty-actions">
                  <Guard
                    allowed={canCreateProd}
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
                      Novo produto
                    </button>
                  </Guard>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setBusca('');
                      setFiltroAtivo(null);
                    }}
                  >
                    Limpar busca/filtros
                  </button>
                </div>
              }
            />
          ) : (
            pagination.paginatedItems.map(produto => (
            <div key={produto.id} className={`produto-card ${!produto.ativo ? 'inativo' : ''}`}>
              <div className="produto-header">
                <div className="produto-card-identity">
                  <div className={`produto-thumb ${getProdutoFoto(produto) ? 'has-photo' : ''}`}>
                    {getProdutoFoto(produto) ? (
                      <button
                        type="button"
                        className="produto-thumb-button"
                        onClick={() => openProductPhotoPreview(produto)}
                        aria-label={`Abrir foto de ${produto.nome}`}
                        title="Abrir foto"
                      >
                        <img src={getProdutoFoto(produto)} alt={`Foto de ${produto.nome}`} loading="lazy" />
                      </button>
                    ) : (
                      <span>ST</span>
                    )}
                  </div>
                  <div>
                  <h3>{produto.nome}</h3>
                  {produto.categoria && (
                    <span className="produto-categoria">{produto.categoria}</span>
                  )}
                  </div>
                </div>
                <div className="produto-actions">
                  <button
                    className="btn-icon"
                    onClick={() => {
                      const result = togglePinnedProduct(produto.id);
                      setPinnedIds(result.ids);
                      showToast(result.pinned ? '📌 Produto fixado para venda rápida' : '📌 Produto removido dos fixados', 'success');
                      // Atualização cross-component é feita via evento dedicado (app-events)
                      // (evita recarregar páginas inteiras via 'storage')
                      
                    }}
                    aria-label="Fixar produto"
                    title={pinnedIds.includes(produto.id) ? 'Desafixar produto' : 'Fixar produto para venda rápida'}
                    type="button"
                  >
                    {pinnedIds.includes(produto.id) ? '📌' : '📍'}
                  </button>
                  <Guard 
                    allowed={canEditProd}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleEditar(produto)}
                      aria-label="Editar"
                      title="Editar produto"
                    >
                      ✏️
                    </button>
                  </Guard>
                  <Guard 
                    allowed={canDeleteProd}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleDeletar(produto.id)}
                      aria-label="Deletar"
                      title="Excluir produto"
                    >
                      🗑️
                    </button>
                  </Guard>
                </div>
              </div>
              <div className="produto-info">
                {produto.descricao && (
                  <p className="produto-descricao">{produto.descricao}</p>
                )}
                <div className="produto-valores">
                  <div>
                    <span className="label">Preço:</span>
                    <span className="value price">{formatCurrency(produto.preco)}</span>
                  </div>
                  {produto.custo && (
                    <div>
                      <span className="label">Custo:</span>
                      <span className="value">{formatCurrency(produto.custo)}</span>
                    </div>
                  )}
                  <div>
                    <span className="label">Estoque:</span>
                    <span className={`value ${produto.estoque === 0 ? 'estoque-zero' : ''}`}>
                      {produto.estoque}
                    </span>
                  </div>
                </div>
                {produto.codigoBarras && (
                  <p className="produto-codigo"><strong>Código:</strong> {produto.codigoBarras}</p>
                )}
                <div className="produto-footer">
                  <span className={`status-badge ${produto.ativo ? 'ativo' : 'inativo'}`}>
                    {produto.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="produto-data">{formatDate(produto.created_at || new Date().toISOString())}</span>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      )}

      {!fastMode && produtos.length > 0 && (
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
    </div>
  );
}

export default ProdutosPage;
