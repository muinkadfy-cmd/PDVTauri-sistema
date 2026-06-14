import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { Cliente } from '@/types';
import { getClientes, criarCliente, atualizarCliente, deletarCliente } from '@/lib/clientes';
import { logger } from '@/utils/logger';
import { canCreate, canEdit, canDelete } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import FormField from '@/components/ui/FormField';
import Pagination from '@/components/ui/Pagination';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import { showToast } from '@/components/ui/ToastContainer';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { isValidEmail, isValidPhone, isValidCPF, isValidCEP, formatPhone, formatCPF, formatCEP } from '@/utils/validators';
import { useSmartForm } from '@/hooks/useSmartForm';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { sugerirDadosCliente } from '@/lib/clientes-helpers';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';
import './ClientesPage.css';

function ClientesPage() {
  // ✅ Passo 5: separar "base" (allClientes) do "visível" (clientes)
  // Evita bater no Repository a cada tecla e reduz custo de toLowerCase repetido.
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const buscaRef = useRef('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialForm = {
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: ''
  };

  const {
    formData,
    setFormData,
    clearDraft,
    resetForm,
    hasDraft
  } = useSmartForm({
    formKey: 'clientes',
    initialValues: initialForm
  });

  const carregarClientes = useCallback(() => {
    // ✅ Mais recente primeiro (sem mudar o storage)
    const base = [...getClientes()].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    rebuildIndex(base);
    startTransition(() => {
      setAllClientes(base);
      // Se houver busca ativa, o effect acima vai filtrar imediatamente
      const termo = (buscaRef.current || '').trim();
      if (!termo) setClientes(base);
    });
  }, [startTransition]);

  useEffect(() => {
    try { perfMarkOnce('screen_mounted:clientes'); } catch {}
    if (import.meta.env.DEV) {
      logger.log('[ClientesPage] Carregando clientes ao montar componente');
    }
    carregarClientes();

    // Marca pronto após 1 render (evita medir antes do paint)
    try {
      requestAnimationFrame(() => {
        perfMarkOnce('screen_ready:clientes');
        perfMeasure('private_shell→clientes', 'private_shell', 'screen_ready:clientes');
      });
    } catch {
      // ignore
    }
    
    // Sincronização automática
    let refreshTimer: number | null = null;
    const scheduleRefresh = (delay = 120) => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        carregarClientes();
      }, delay);
    };

    const atualizarClientes = () => scheduleRefresh();
    
    // Escutar eventos de storage (outras abas)
    window.addEventListener('storage', atualizarClientes);
    // Escutar eventos customizados (mesma aba)
    window.addEventListener('smart-tech-cliente-criado', atualizarClientes);
    window.addEventListener('smart-tech-cliente-atualizado', atualizarClientes);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener('storage', atualizarClientes);
      window.removeEventListener('smart-tech-cliente-criado', atualizarClientes);
      window.removeEventListener('smart-tech-cliente-atualizado', atualizarClientes);
    };
  }, [carregarClientes]);

  const debouncedBusca = useDebounce(busca, 300);

  // Índice de busca leve em memória (recalcula só quando a base muda)
  const searchIndex = useRef<Array<{ id: string; key: string }>>([]);

  const rebuildIndex = (items: Cliente[]) => {
    // Cria uma string única (normalizada) por item para acelerar includes()
    searchIndex.current = items.map((c) => {
      const key = `${c.nome || ''} ${c.email || ''} ${c.telefone || ''} ${c.cpf || ''}`.toLowerCase();
      return { id: c.id, key };
    });
  };

  useEffect(() => {
    buscaRef.current = busca;
  }, [busca]);
  const debouncedTelefone = useDebounce(formData.telefone, 300);

  useEffect(() => {
    // Filtrar somente em memória (rápido). Repository só é consultado em "carregarClientes".
    const termo = (debouncedBusca || '').trim().toLowerCase();
    startTransition(() => {
      if (!termo) {
        setClientes(allClientes);
        return;
      }
      const idx = searchIndex.current;
      const allow = new Set(idx.filter((x) => x.key.includes(termo)).map((x) => x.id));
      setClientes(allClientes.filter((c) => allow.has(c.id)));
    });
  }, [debouncedBusca, allClientes]);

  // Auto-preenchimento: ao digitar telefone, sugerir dados se cliente já existir
  useEffect(() => {
    if (clienteEditando) return;
    const digits = (debouncedTelefone || '').replace(/\D/g, '');
    if (digits.length < 10) return;
    if (formData.nome?.trim()) return;

    const sugestao = sugerirDadosCliente(debouncedTelefone);
    if (sugestao?.nome) {
      setFormData((prev) => ({
        ...prev,
        ...sugestao,
        // manter telefone do que o usuário digitou
        telefone: prev.telefone
      }));
      showToast('Cliente encontrado! Dados preenchidos automaticamente.', 'info');
    }
  }, [debouncedTelefone, clienteEditando]);

  // Paginação
  const pagination = usePagination(clientes, { itemsPerPage: 20 });

  const limparForm = () => {
    // Não apagar rascunho ao fechar (produtividade). Usuário pode limpar manualmente.
    setClienteEditando(null);
    setMostrarForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!formData.nome.trim()) {
      showToast('Nome é obrigatório', 'error');
      return;
    }

    if (formData.email && !isValidEmail(formData.email)) {
      showToast('Email inválido', 'error');
      return;
    }

    if (formData.telefone && !isValidPhone(formData.telefone)) {
      showToast('Telefone inválido', 'error');
      return;
    }

    if (formData.cpf && !isValidCPF(formData.cpf)) {
      showToast('CPF inválido', 'error');
      return;
    }

    if (formData.cep && !isValidCEP(formData.cep)) {
      showToast('CEP inválido', 'error');
      return;
    }
    
    // Formatar dados antes de salvar
    const dadosFormatados = {
      ...formData,
      telefone: formData.telefone ? formatPhone(formData.telefone) : '',
      cpf: formData.cpf ? formatCPF(formData.cpf) : '',
      cep: formData.cep ? formatCEP(formData.cep) : '',
    };
    
    let resultado: Cliente | null = null;
    
    if (clienteEditando) {
      resultado = await atualizarCliente(clienteEditando.id, dadosFormatados);
      if (resultado) {
        showToast('Cliente atualizado com sucesso!', 'success');
      } else {
        showToast('Erro ao atualizar cliente. Verifique os dados e tente novamente.', 'error');
        return;
      }
    } else {
      resultado = await criarCliente(dadosFormatados);
      if (resultado) {
        showToast('Cliente criado com sucesso!', 'success');
      } else {
        showToast('Erro ao criar cliente. Verifique os dados e tente novamente.', 'error');
        return;
      }
    }
    
    carregarClientes();
    // Após salvar com sucesso: limpar rascunho e fechar
    resetForm();
    clearDraft();
    limparForm();
  };

  const handleEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setFormData(() => ({
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      cpf: cliente.cpf || '',
      endereco: cliente.endereco || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      cep: cliente.cep || '',
      observacoes: cliente.observacoes || ''
    }));
    setMostrarForm(true);
  };

  const handleDeletar = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      const sucesso = await deletarCliente(id);
      if (sucesso) {
        showToast('Cliente excluído com sucesso!', 'success');
        carregarClientes();
      } else {
        showToast('Erro ao excluir cliente.', 'error');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isClienteFormDirty = mostrarForm && Object.values(formData).some((valor) => String(valor ?? '').trim().length > 0);

  const readOnly = isReadOnlyMode();
  const canCreateClient = canCreate() && !readOnly;
  const canEditClient = canEdit() && !readOnly;
  const canDeleteClient = canDelete() && !readOnly;

  return (
    <div className="clientes-page page-container">
      <ReadOnlyBanner />
      <PageHeader
        kicker="Cadastros"
        title="Clientes"
        subtitle="Cadastro, busca e contato rápido de clientes."
        actions={
          <div className="clientes-header-actions">
            <Guard
              allowed={canCreateClient}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
            >
              <button
                className="btn-primary"
                onClick={() => {
                  setClienteEditando(null);
                  setMostrarForm(true);
                }}
              >
                Novo cliente
              </button>
            </Guard>
          </div>
        }
      >
      </PageHeader>

      <PageToolbar
        sticky={false}
        left={(
          <div className="search-bar clientes-search">
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="search-input"
            />
          </div>
        )}
        right={(
          <div className="clientes-toolbar-meta">
            {pagination.totalItems} {pagination.totalItems === 1 ? 'cliente' : 'clientes'}
          </div>
        )}
      />

<Modal
        isOpen={mostrarForm}
        onClose={limparForm}
        title={clienteEditando ? 'Editar Cliente' : 'Novo Cliente'}
        size="md"
        isDirty={isClienteFormDirty}
        closeConfirmMessage="O cadastro de cliente tem dados não salvos. Deseja sair mesmo assim?"
        footer={(
          <>
            <span className="form-shortcut-hint">Ctrl+Enter salva</span>
            <button type="button" className="btn-secondary" onClick={limparForm}>
              Cancelar
            </button>
            <Guard
              allowed={clienteEditando ? canEditClient : canCreateClient}
              mode="disable"
              reason={readOnly ? 'Modo leitura (licença expirada)' : clienteEditando ? 'Sem permissão para editar' : 'Sem permissão para criar'}
            >
              <button type="submit" className="btn-primary" form="cliente-form" disabled={readOnly}>
                {readOnly ? 'Modo leitura' : clienteEditando ? 'Salvar' : 'Criar'}
              </button>
            </Guard>
          </>
        )}
      >
        <form id="cliente-form" onSubmit={handleSubmit} className="standard-form" autoComplete="on">
          <div className="form-validation-hint">Corrija os campos destacados antes de salvar.</div>
          {hasDraft && !clienteEditando && (
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
            <FormField label="Nome" required>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="form-input"
                readOnly={readOnly}
                autoFocus
                autoComplete="name"
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input"
                placeholder="exemplo@email.com"
                readOnly={readOnly}
                autoComplete="email"
              />
            </FormField>
            <FormField label="Telefone">
              <div className="input-with-action">
                <MaskedInput
                  value={formData.telefone}
                  onChange={(value) => {
                    if (readOnly) return;
                    setFormData({ ...formData, telefone: value });
                  }}
                  className="form-input"
                  placeholder="(11) 98765-4321"
                  readOnly={readOnly}
                  mask="phone"
                  autoComplete="tel"
                />
                {formData.telefone && (
                  <WhatsAppIcon telefone={formData.telefone} className="inline" />
                )}
              </div>
            </FormField>
            <FormField label="CPF">
              <MaskedInput
                value={formData.cpf}
                onChange={(value) => {
                  if (readOnly) return;
                  setFormData({ ...formData, cpf: value });
                }}
                className="form-input"
                placeholder="123.456.789-00"
                readOnly={readOnly}
                mask="cpf"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Endereço">
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="form-input"
                readOnly={readOnly}
                autoComplete="street-address"
              />
            </FormField>
            <FormField label="Cidade">
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="form-input"
                readOnly={readOnly}
                autoComplete="address-level2"
              />
            </FormField>
            <FormField label="Estado">
              <input
                type="text"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="form-input"
                readOnly={readOnly}
                autoComplete="address-level1"
              />
            </FormField>
            <FormField label="CEP">
              <MaskedInput
                value={formData.cep}
                onChange={(value) => {
                  if (readOnly) return;
                  setFormData({ ...formData, cep: value });
                }}
                className="form-input"
                placeholder="12345-678"
                readOnly={readOnly}
                mask="cep"
                autoComplete="postal-code"
              />
            </FormField>
          </div>
          <FormField label="Observações" fullWidth>
            <textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
              className="form-textarea"
              readOnly={readOnly}
            />
          </FormField>
        </form>
      </Modal>

      <div className="clientes-grid">
        {pagination.paginatedItems.length === 0 ? (
          <EmptyState
            icon="👤"
            title="Nenhum cliente ainda"
            message="Cadastre um cliente para agilizar vendas, ordens de serviço e buscas futuras."
            compact
            className="clientes-empty-state"
            actionsSlot={
              <div className="empty-state-actions">
                <Guard
                  allowed={canCreateClient}
                  mode="disable"
                  reason={readOnly ? 'Modo leitura (licença expirada)' : 'Sem permissão para criar'}
                >
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      resetForm();
                      setClienteEditando(null);
                      setMostrarForm(true);
                    }}
                  >
                    + Novo cliente
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
          pagination.paginatedItems.map(cliente => (
            <div key={cliente.id} className="cliente-card">
              <div className="cliente-header">
                <h3>{cliente.nome}</h3>
                <div className="cliente-actions">
                  <Guard 
                    allowed={canEditClient}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleEditar(cliente)}
                      aria-label="Editar"
                      title="Editar cliente"
                    >
                      ✏️
                    </button>
                  </Guard>
                  <Guard 
                    allowed={canDeleteClient}
                    mode="hide"
                  >
                    <button
                      className="btn-icon"
                      onClick={() => handleDeletar(cliente.id)}
                      aria-label="Deletar"
                      title="Excluir cliente"
                    >
                      🗑️
                    </button>
                  </Guard>
                </div>
              </div>
              <div className="cliente-info">
                {cliente.email && <p><strong>Email:</strong> {cliente.email}</p>}
                {cliente.telefone && (
                  <p className="telefone-info">
                    <strong>Telefone:</strong> {cliente.telefone}
                    <WhatsAppIcon telefone={cliente.telefone} className="inline" />
                  </p>
                )}
                {cliente.cpf && <p><strong>CPF:</strong> {cliente.cpf}</p>}
                {(cliente.cidade || cliente.estado) && (
                  <p><strong>Localização:</strong> {cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</p>
                )}
                <p className="cliente-data"><strong>Cadastrado em:</strong> {formatDate(cliente.created_at || new Date().toISOString())}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {clientes.length > 0 && (
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

export default ClientesPage;
