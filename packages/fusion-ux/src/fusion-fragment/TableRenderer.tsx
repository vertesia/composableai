/**
 * TableRenderer component
 * Renders a table with columns and row data
 */

import React, { useMemo, type ReactElement } from 'react';
import type { ColumnTemplate } from '../types.js';

const styles = {
  container: {
    width: '100%',
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  thead: {
    backgroundColor: 'var(--gray-3, #f3f4f6)',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--gray-11, #6b7280)',
    borderBottom: '2px solid var(--gray-5, #e5e7eb)',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--gray-4, #e5e7eb)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  trHover: {
    backgroundColor: 'var(--gray-2, #f9fafb)',
  },
  empty: {
    padding: '20px',
    textAlign: 'center' as const,
    color: 'var(--gray-10, #9ca3af)',
    fontStyle: 'italic' as const,
  },
  highlight: {
    success: { color: 'var(--green-11, #15803d)' },
    warning: { color: 'var(--yellow-11, #ca8a04)' },
    error: { color: 'var(--red-11, #dc2626)' },
    info: { color: 'var(--blue-11, #2563eb)' },
  },
};

export interface TableRendererProps {
  columns: ColumnTemplate[];
  rows: Record<string, unknown>[];
}

/**
 * Format a cell value according to column format
 */
function formatCellValue(value: unknown, column: ColumnTemplate): string {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (column.format) {
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: column.decimals ?? 2,
      }).format(num);
    }

    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: column.currency || 'USD',
        minimumFractionDigits: column.decimals ?? 0,
        maximumFractionDigits: column.decimals ?? 0,
      }).format(num);
    }

    case 'percent': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      const pct = num < 1 && num > -1 && num !== 0 ? num * 100 : num;
      return `${pct.toFixed(column.decimals ?? 1)}%`;
    }

    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    }

    case 'boolean':
      return value ? 'Yes' : 'No';

    default:
      return String(value);
  }
}

/**
 * TableRenderer component
 */
export function TableRenderer({ columns, rows }: TableRendererProps): ReactElement {
  const alignmentStyle = useMemo(() => {
    return columns.reduce((acc, col) => {
      acc[col.key] = col.align || (
        col.format === 'number' || col.format === 'currency' || col.format === 'percent'
          ? 'right'
          : 'left'
      );
      return acc;
    }, {} as Record<string, string>);
  }, [columns]);

  if (rows.length === 0) {
    return (
      <div style={styles.container}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...styles.th,
                    textAlign: alignmentStyle[col.key] as 'left' | 'center' | 'right',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} style={styles.empty}>
                No data available
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...styles.th,
                  textAlign: alignmentStyle[col.key] as 'left' | 'center' | 'right',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => {
                const value = row[col.key];
                const formatted = formatCellValue(value, col);
                const cellStyle = {
                  ...styles.td,
                  textAlign: alignmentStyle[col.key] as 'left' | 'center' | 'right',
                  ...(col.highlight ? styles.highlight[col.highlight] : {}),
                };

                return (
                  <td key={col.key} style={cellStyle}>
                    {formatted}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
