/**
 * Barra de busca responsiva com debounce
 */

import { useState, useEffect, useRef } from 'react';

export interface SearchBarProps {
  placeholder?: string;
  onSearch: (term: string) => void;
  debounceMs?: number;
  className?: string;
}

export function SearchBar({
  placeholder = 'Buscar...',
  onSearch,
  debounceMs = 250,
  className = ''
}: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpar timer anterior
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Criar novo timer
    debounceTimer.current = setTimeout(() => {
      onSearch(searchTerm);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchTerm, onSearch, debounceMs]);

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className={`search-bar ${className}`} style={{
      position: 'relative',
      width: '100%',
      maxWidth: '500px',
      margin: '0 auto 1rem'
    }}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem 2.5rem 0.75rem 1rem',
          border: '1px solid var(--border-light, #ddd)',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--primary, #4CAF50)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-light, #ddd)';
        }}
      />
      {searchTerm && (
        <button
          onClick={handleClear}
          type="button"
          aria-label="Limpar busca"
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            color: 'var(--text-secondary, #666)',
            fontSize: '1.25rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f5f5f5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ×
        </button>
      )}
      <style>{`
        .search-bar input:focus {
          border-color: var(--primary, #4CAF50) !important;
        }
        
        @media (max-width: 768px) {
          .search-bar {
            max-width: 100%;
          }
          
          .search-bar input {
            font-size: 16px; /* Evita zoom no iOS */
          }
        }
      `}</style>
    </div>
  );
}
