import { ReactNode } from 'react';
import './TableMobile.css';

interface TableColumn<T = any> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  mobileLabel?: string; // Label mais curto para mobile
  mobilePriority?: number; // Prioridade de exibição (1 = mais importante)
}

interface TableMobileProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

function TableMobile<T = any>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Nenhum item encontrado',
  onRowClick
}: TableMobileProps<T>) {
  if (data.length === 0) {
    return (
      <div className="table-mobile-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Ordenar colunas por prioridade (menor número = maior prioridade)
  const sortedColumns = [...columns].sort((a, b) => {
    const priorityA = a.mobilePriority ?? 999;
    const priorityB = b.mobilePriority ?? 999;
    return priorityA - priorityB;
  });

  // Pegar as 3 colunas mais importantes para mobile
  const primaryColumns = sortedColumns.slice(0, 3);
  const secondaryColumns = sortedColumns.slice(3);

  return (
    <div className="table-mobile-container">
      {data.map((item) => {
        const primaryData = primaryColumns.map(col => ({
          key: col.key,
          label: col.mobileLabel || col.label,
          value: col.render ? col.render(item) : (item as any)[col.key],
          align: col.align || 'left'
        }));

        const secondaryData = secondaryColumns.map(col => ({
          key: col.key,
          label: col.mobileLabel || col.label,
          value: col.render ? col.render(item) : (item as any)[col.key],
          align: col.align || 'left'
        }));

        return (
          <div
            key={keyExtractor(item)}
            className={`table-mobile-card ${onRowClick ? 'clickable' : ''}`}
            onClick={() => onRowClick?.(item)}
          >
            {/* Linha principal - 3 campos mais importantes */}
            <div className="table-mobile-primary">
              {primaryData.map((field, idx) => (
                <div key={field.key} className={`table-mobile-field ${idx === 0 ? 'main' : ''}`}>
                  {idx === 0 ? (
                    <div className="table-mobile-main-value">{field.value}</div>
                  ) : (
                    <>
                      <span className="table-mobile-label">{field.label}:</span>
                      <span className="table-mobile-value">{field.value}</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Linhas secundárias - campos adicionais */}
            {secondaryData.length > 0 && (
              <div className="table-mobile-secondary">
                {secondaryData.map((field) => (
                  <div key={field.key} className="table-mobile-field">
                    <span className="table-mobile-label">{field.label}:</span>
                    <span className="table-mobile-value">{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TableMobile;
