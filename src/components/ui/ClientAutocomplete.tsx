import { useState, useEffect, useRef } from 'react';
import { Cliente } from '@/types';
import './ClientAutocomplete.css';

interface ClientAutocompleteProps {
  clientes: Cliente[];
  value: string;
  onChange: (clienteId: string) => void;
  onNewClient?: () => void;
  onQuickCreate?: (nome: string) => void;
  onSelectCliente?: (cliente: Cliente) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

function ClientAutocomplete({
  clientes,
  value,
  onChange,
  onNewClient,
  onQuickCreate,
  onSelectCliente,
  disabled = false,
  required = false,
  placeholder = 'Digite o nome do cliente...',
  autoFocus = false
}: ClientAutocompleteProps) {
  // ✅ Segurança: evita crash quando "clientes" vier undefined (ex.: carregamento assíncrono)
  const clientesSafe: Cliente[] = Array.isArray(clientes) ? clientes : [];

  const [busca, setBusca] = useState('');
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clienteSelecionado = clientesSafe.find(c => c.id === value);

  useEffect(() => {
    if (clienteSelecionado) {
      setBusca(clienteSelecionado.nome);
    } else {
      setBusca('');
    }
  }, [value, clienteSelecionado]);

  useEffect(() => {
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      const filtrados = clientesSafe.filter(cliente =>
        [cliente.nome, cliente.telefone, cliente.cpf, cliente.email, cliente.endereco]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(termo))
      );
      setClientesFiltrados(filtrados);
      setMostrarDropdown(filtrados.length > 0 || busca.length > 0);
    } else {
      setClientesFiltrados([]);
      setMostrarDropdown(false);
    }
  }, [busca, clientesSafe]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setMostrarDropdown(false);
      }
    }

    if (mostrarDropdown) {
      const fn = handleClickOutside as EventListener;
      document.addEventListener('mousedown', fn);
      document.addEventListener('touchstart', fn, true);
      return () => {
        document.removeEventListener('mousedown', fn);
        document.removeEventListener('touchstart', fn, true);
      };
    }
  }, [mostrarDropdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoValor = e.target.value;
    setBusca(novoValor);
    
    if (!novoValor.trim()) {
      onChange('');
    }
  };

  const handleSelectCliente = (cliente: Cliente) => {
    onChange(cliente.id);
    onSelectCliente?.(cliente);
    setBusca(cliente.nome);
    setMostrarDropdown(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    if (busca.trim() || clientesSafe.length > 0) {
      setMostrarDropdown(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && clientesFiltrados.length === 1) {
      e.preventDefault();
      handleSelectCliente(clientesFiltrados[0]);
    } else if (e.key === 'Escape') {
      setMostrarDropdown(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="client-autocomplete" ref={containerRef}>
      <div className="input-with-action">
        <input
          ref={inputRef}
          type="text"
          value={busca}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className="form-input"
          autoComplete="off"
          autoFocus={autoFocus}
          data-modal-search="true"
        />
        {onNewClient && !disabled && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onNewClient}
            title="Criar novo cliente"
          >
            + Novo
          </button>
        )}
      </div>
      
      {mostrarDropdown && (
        <div className="autocomplete-dropdown">
          {clientesFiltrados.length > 0 ? (
            <>
              {clientesFiltrados.map(cliente => (
                <button
                  key={cliente.id}
                  type="button"
                  className={`autocomplete-option ${value === cliente.id ? 'selected' : ''}`}
                  onClick={() => handleSelectCliente(cliente)}
                >
                  <div className="option-name">{cliente.nome}</div>
                  {(cliente.telefone || cliente.cpf || cliente.email) && (
                    <div className="option-phone">
                      {[cliente.telefone, cliente.cpf, cliente.email].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              ))}
            </>
          ) : busca.trim() ? (
            <div className="autocomplete-empty">
              <p>Nenhum cliente encontrado</p>
              {onQuickCreate ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => {
                    onQuickCreate(busca);
                    setMostrarDropdown(false);
                  }}
                >
                  Criar "{busca}"
                </button>
              ) : onNewClient ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={onNewClient}
                >
                  Criar Novo Cliente
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ClientAutocomplete;
