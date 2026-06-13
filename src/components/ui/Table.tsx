import { ReactNode } from 'react';
import './Table.css';

interface TableColumn<T = any> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  hover?: boolean;
  /** Força densidade compacta independentemente do modo global */
  dense?: boolean;
}

function Table<T = any>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Nenhum item encontrado',
  onRowClick,
  striped = true,
  hover = true,
  dense = false
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="table-empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className={`table ${dense ? 'table-dense' : ''} ${striped ? 'table-striped' : ''} ${hover ? 'table-hover' : ''}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: column.align || 'left',
                  width: column.width
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'table-row-clickable' : ''}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    textAlign: column.align || 'left'
                  }}
                >
                  {column.render
                    ? column.render(item)
                    : (item as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
