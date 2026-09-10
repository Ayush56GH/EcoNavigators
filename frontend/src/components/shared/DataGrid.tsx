import React from 'react';

export interface DataCellItem {
  label: string;
  value: string | number | React.ReactNode;
  highlight?: boolean;
}

interface DataGridProps {
  items: DataCellItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export default function DataGrid({ items, columns = 2, className = '' }: DataGridProps) {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: '0.75rem',
  };

  return (
    <div className={`data-grid-container ${className}`} style={gridStyle}>
      {items.map((item, idx) => (
        <div key={idx} className="data-cell">
          <div className="data-cell-label">{item.label}</div>
          <div className="data-cell-value" style={item.highlight ? { color: 'var(--accent-cyan)' } : undefined}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
