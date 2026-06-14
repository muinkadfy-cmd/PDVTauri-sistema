import { useEffect, useMemo, useRef, useState } from 'react';
import { Produto } from '@/types';
import './ProductAutocomplete.css';

interface ProductAutocompleteProps {
  produtos: Produto[];
  value?: string;
  onChange: (produto: Produto) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function ProductAutocomplete({
  produtos,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar produto por nome, código ou categoria...',
  autoFocus = false,
}: ProductAutocompleteProps) {
  const produtosSafe = Array.isArray(produtos) ? produtos : [];
  const selected = produtosSafe.find((produto) => produto.id === value);
  const selectedLabel = selected?.nome ?? '';
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBusca(selectedLabel);
    setOpen(false);
  }, [selected?.id, selectedLabel]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    if (open) {
      const fn = handleClickOutside as EventListener;
      document.addEventListener('mousedown', fn);
      document.addEventListener('touchstart', fn, true);
      return () => {
        document.removeEventListener('mousedown', fn);
        document.removeEventListener('touchstart', fn, true);
      };
    }
  }, [open]);

  const filtrados = useMemo(() => {
    const termo = normalize(busca);
    const ativos = produtosSafe.filter((produto) => produto.ativo !== false);

    if (!termo) return ativos.slice(0, 30);

    return ativos
      .filter((produto) => {
        const searchable = [
          produto.nome,
          produto.codigoBarras,
          produto.categoria,
          produto.descricao,
          produto.id,
        ].map(normalize).join(' ');
        return searchable.includes(termo);
      })
      .slice(0, 30);
  }, [busca, produtosSafe]);

  const selectProduto = (produto: Produto) => {
    onChange(produto);
    setBusca(produto.nome);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filtrados.length > 0) {
      e.preventDefault();
      selectProduto(filtrados[0]);
    }

    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const shouldShowDropdown = open && !disabled && busca.trim().length > 0 && normalize(busca) !== normalize(selectedLabel);

  return (
    <div className="product-autocomplete" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="form-input"
        value={busca}
        onChange={(e) => {
          const next = e.target.value;
          setBusca(next);
          setOpen(next.trim().length > 0 && normalize(next) !== normalize(selectedLabel));
        }}
        onFocus={() => {
          const termoAtual = busca.trim();
          setOpen(termoAtual.length > 0 && normalize(termoAtual) !== normalize(selectedLabel));
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        data-modal-search="true"
        data-modal-autofocus={autoFocus ? 'true' : undefined}
      />

      {shouldShowDropdown && (
        <div className="product-autocomplete-dropdown">
          {filtrados.length > 0 ? (
            filtrados.map((produto) => (
              <button
                key={produto.id}
                type="button"
                className={`product-autocomplete-option ${produto.id === value ? 'selected' : ''} ${Number(produto.estoque ?? 0) <= 0 ? 'stock-empty' : ''}`}
                onClick={() => selectProduto(produto)}
              >
                <span className="product-autocomplete-main">
                  <strong className="product-autocomplete-title" title={produto.nome}>{produto.nome}</strong>
                  <span className="product-autocomplete-price">R$ {Number(produto.preco || 0).toFixed(2).replace('.', ',')}</span>
                </span>
                <span className="product-autocomplete-meta">
                  {produto.codigoBarras ? `Código: ${produto.codigoBarras}` : 'Sem código'}
                  {' · '}
                  Estoque: {Number(produto.estoque ?? 0)}
                  {produto.categoria ? ` · ${produto.categoria}` : ''}
                </span>
              </button>
            ))
          ) : (
            <div className="product-autocomplete-empty">
              Nenhum produto encontrado. Use “Item Manual” para venda avulsa.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductAutocomplete;
