/**
 * Fusion Fragment Types
 *
 * Re-exports fragment types that are used within page content.
 * These mirror the types in @vertesia/fusion-ux for use in the common package.
 */

// ============================================================================
// Fragment Template Types
// ============================================================================

/**
 * Root template structure for a fusion fragment.
 */
export interface FragmentTemplate {
    /** Optional title displayed at the top */
    title?: string;
    /** Type of entity being displayed - helps with context */
    entityType?: 'fund' | 'scenario' | 'portfolio' | 'transaction' | 'custom';
    /** Sections containing fields */
    sections: SectionTemplate[];
    /** Optional footer text */
    footer?: string;
}

/**
 * A section within the fragment, containing related fields, a table, or a chart.
 */
export interface SectionTemplate {
    /** Section title/header */
    title: string;
    /** Layout mode for the fields */
    layout?: 'grid-2' | 'grid-3' | 'grid-4' | 'list' | 'table' | 'chart';
    /** Whether the section is initially collapsed */
    collapsed?: boolean;
    /** Fields in this section (for grid/list layouts) */
    fields?: FieldTemplate[];
    /** Table columns (for table layout) */
    columns?: ColumnTemplate[];
    /** Data key for table rows - points to an array in data */
    dataKey?: string;
    /** Chart specification (for chart layout) */
    chart?: ChartTemplate;
}

/**
 * A single field definition.
 */
export interface FieldTemplate {
    /** Display label for the field */
    label: string;
    /** Key to look up in data - REQUIRED */
    key: string;
    /** Display format */
    format?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
    /** Unit to display after value (e.g., "years", "USD") */
    unit?: string;
    /** Whether this field is editable */
    editable?: boolean;
    /** Input type when editing */
    inputType?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    /** Options for select input type */
    options?: Array<{ label: string; value: string }>;
    /** Min value for number inputs */
    min?: number;
    /** Max value for number inputs */
    max?: number;
    /** Visual highlight style */
    highlight?: 'success' | 'warning' | 'error' | 'info';
    /** Tooltip text on hover */
    tooltip?: string;
    /** Number of decimal places for number format */
    decimals?: number;
    /** Currency code for currency format */
    currency?: string;
}

/**
 * A column definition for table layout.
 */
export interface ColumnTemplate {
    /** Column header text */
    header: string;
    /** Key to look up in each row object */
    key: string;
    /** Display format */
    format?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
    /** Column width (optional, e.g., '100px', '20%') */
    width?: string;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
    /** Currency code for currency format */
    currency?: string;
    /** Number of decimal places */
    decimals?: number;
    /** Highlight based on value */
    highlight?: 'success' | 'warning' | 'error' | 'info';
}

/**
 * Chart specification for chart layout (Vega-Lite based).
 */
export interface ChartTemplate {
    /** Chart title (displayed above the chart) */
    title?: string;
    /** Chart description */
    description?: string;
    /** Vega-Lite specification */
    spec: VegaLiteSpec;
    /** Chart height in pixels */
    height?: number;
    /** Chart width in pixels (defaults to container width) */
    width?: number;
    /** Data key - if provided, data from this key replaces spec.data.values */
    dataKey?: string;
}

/**
 * Vega-Lite specification (simplified subset).
 */
export interface VegaLiteSpec {
    /** Schema URL (optional) */
    $schema?: string;
    /** Inline data or data source */
    data?: {
        values?: Record<string, unknown>[];
        url?: string;
        format?: { type?: 'json' | 'csv' | 'tsv' };
    };
    /** Mark type (bar, line, point, area, etc.) */
    mark?: string | { type: string; [key: string]: unknown };
    /** Encoding channels (x, y, color, size, etc.) */
    encoding?: Record<string, unknown>;
    /** Vertical concatenation */
    vconcat?: VegaLiteSpec[];
    /** Horizontal concatenation */
    hconcat?: VegaLiteSpec[];
    /** Layer multiple marks */
    layer?: VegaLiteSpec[];
    /** Transform operations */
    transform?: Record<string, unknown>[];
    /** Interactive parameters */
    params?: Record<string, unknown>[];
    /** Chart configuration */
    config?: Record<string, unknown>;
    /** Allow additional Vega-Lite properties */
    [key: string]: unknown;
}
