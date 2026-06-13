import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  startIndex?: number;
  endIndex?: number;
  totalItems?: number;
  itemsPerPage?: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  onNext,
  onPrev,
  canGoNext = true,
  canGoPrev = true,
  startIndex,
  endIndex,
  totalItems,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null; // Não mostra paginação se houver apenas 1 página
  }

  const handlePrev = () => {
    if (onPrev) {
      onPrev();
    } else {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      onPageChange(currentPage + 1);
    }
  };

  // Gerar array de páginas para exibir
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Mostrar todas as páginas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Mostrar páginas com ellipsis
      if (currentPage <= 3) {
        // Início: 1, 2, 3, 4, ..., totalPages
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Fim: 1, ..., totalPages-3, totalPages-2, totalPages-1, totalPages
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Meio: 1, ..., currentPage-1, currentPage, currentPage+1, ..., totalPages
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="pagination">
      <div className="pagination-info">
        {startIndex !== undefined && endIndex !== undefined && totalItems !== undefined && (
          <span className="pagination-text">
            Mostrando {startIndex} a {endIndex} de {totalItems} itens
          </span>
        )}
      </div>
      
      <div className="pagination-controls">
        <button
          className="pagination-button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Página anterior"
        >
          ‹
        </button>
        
        <div className="pagination-pages">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                  ...
                </span>
              );
            }
            
            const pageNum = page as number;
            const isActive = pageNum === currentPage;
            
            return (
              <button
                key={pageNum}
                className={`pagination-page ${isActive ? 'active' : ''}`}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Ir para página ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        <button
          className="pagination-button"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Próxima página"
        >
          ›
        </button>
      </div>
    </div>
  );
}
