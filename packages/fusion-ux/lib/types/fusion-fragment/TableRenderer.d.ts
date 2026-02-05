/**
 * TableRenderer component
 * Renders a table with columns and row data
 */
import { type ReactElement } from 'react';
import type { ColumnTemplate } from '../types.js';
export interface TableRendererProps {
    columns: ColumnTemplate[];
    rows: Record<string, unknown>[];
}
/**
 * TableRenderer component
 */
export declare function TableRenderer({ columns, rows }: TableRendererProps): ReactElement;
//# sourceMappingURL=TableRenderer.d.ts.map