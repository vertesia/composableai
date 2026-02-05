import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * TableRenderer component
 * Renders a table with columns and row data
 */
import { useMemo } from 'react';
const styles = {
    container: {
        width: '100%',
        overflowX: 'auto',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
    },
    thead: {
        backgroundColor: 'var(--gray-3, #f3f4f6)',
    },
    th: {
        padding: '10px 12px',
        textAlign: 'left',
        fontWeight: 600,
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--gray-11, #6b7280)',
        borderBottom: '2px solid var(--gray-5, #e5e7eb)',
    },
    td: {
        padding: '10px 12px',
        borderBottom: '1px solid var(--gray-4, #e5e7eb)',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontVariantNumeric: 'tabular-nums',
    },
    trHover: {
        backgroundColor: 'var(--gray-2, #f9fafb)',
    },
    empty: {
        padding: '20px',
        textAlign: 'center',
        color: 'var(--gray-10, #9ca3af)',
        fontStyle: 'italic',
    },
    highlight: {
        success: { color: 'var(--green-11, #15803d)' },
        warning: { color: 'var(--yellow-11, #ca8a04)' },
        error: { color: 'var(--red-11, #dc2626)' },
        info: { color: 'var(--blue-11, #2563eb)' },
    },
};
/**
 * Format a cell value according to column format
 */
function formatCellValue(value, column) {
    if (value === null || value === undefined) {
        return '—';
    }
    switch (column.format) {
        case 'number': {
            const num = typeof value === 'number' ? value : parseFloat(String(value));
            if (isNaN(num))
                return String(value);
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: column.decimals ?? 2,
            }).format(num);
        }
        case 'currency': {
            const num = typeof value === 'number' ? value : parseFloat(String(value));
            if (isNaN(num))
                return String(value);
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: column.currency || 'USD',
                minimumFractionDigits: column.decimals ?? 0,
                maximumFractionDigits: column.decimals ?? 0,
            }).format(num);
        }
        case 'percent': {
            const num = typeof value === 'number' ? value : parseFloat(String(value));
            if (isNaN(num))
                return String(value);
            const pct = num < 1 && num > -1 && num !== 0 ? num * 100 : num;
            return `${pct.toFixed(column.decimals ?? 1)}%`;
        }
        case 'date': {
            const date = value instanceof Date ? value : new Date(String(value));
            if (isNaN(date.getTime()))
                return String(value);
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
export function TableRenderer({ columns, rows }) {
    const alignmentStyle = useMemo(() => {
        return columns.reduce((acc, col) => {
            acc[col.key] = col.align || (col.format === 'number' || col.format === 'currency' || col.format === 'percent'
                ? 'right'
                : 'left');
            return acc;
        }, {});
    }, [columns]);
    if (rows.length === 0) {
        return (_jsx("div", { style: styles.container, children: _jsxs("table", { style: styles.table, children: [_jsx("thead", { style: styles.thead, children: _jsx("tr", { children: columns.map((col) => (_jsx("th", { style: {
                                    ...styles.th,
                                    textAlign: alignmentStyle[col.key],
                                    width: col.width,
                                }, children: col.header }, col.key))) }) }), _jsx("tbody", { children: _jsx("tr", { children: _jsx("td", { colSpan: columns.length, style: styles.empty, children: "No data available" }) }) })] }) }));
    }
    return (_jsx("div", { style: styles.container, children: _jsxs("table", { style: styles.table, children: [_jsx("thead", { style: styles.thead, children: _jsx("tr", { children: columns.map((col) => (_jsx("th", { style: {
                                ...styles.th,
                                textAlign: alignmentStyle[col.key],
                                width: col.width,
                            }, children: col.header }, col.key))) }) }), _jsx("tbody", { children: rows.map((row, rowIndex) => (_jsx("tr", { children: columns.map((col) => {
                            const value = row[col.key];
                            const formatted = formatCellValue(value, col);
                            const cellStyle = {
                                ...styles.td,
                                textAlign: alignmentStyle[col.key],
                                ...(col.highlight ? styles.highlight[col.highlight] : {}),
                            };
                            return (_jsx("td", { style: cellStyle, children: formatted }, col.key));
                        }) }, rowIndex))) })] }) }));
}
//# sourceMappingURL=TableRenderer.js.map