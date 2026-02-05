/**
 * Fusion Fragment Types
 *
 * These types define the structure of model-generated UI templates.
 * Models generate templates (structure), the system provides data (values).
 */
import type React from 'react';
/**
 * Root template structure for a fusion fragment
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
 * A section within the fragment, containing related fields, a table, or a chart
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
 * A column definition for table layout
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
    /** Highlight based on value (function key in data or static) */
    highlight?: 'success' | 'warning' | 'error' | 'info';
}
/**
 * Chart specification for chart layout (Vega-Lite based)
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
 * Vega-Lite specification (simplified subset)
 * Full spec: https://vega.github.io/vega-lite/docs/spec.html
 */
export interface VegaLiteSpec {
    /** Schema URL (optional) */
    $schema?: string;
    /** Inline data or data source */
    data?: {
        /** Inline data values */
        values?: Record<string, unknown>[];
        /** URL to fetch data from */
        url?: string;
        /** Data format */
        format?: {
            type?: 'json' | 'csv' | 'tsv';
        };
    };
    /** Mark type (bar, line, point, area, etc.) */
    mark?: string | {
        type: string;
        [key: string]: unknown;
    };
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
/**
 * A single field definition
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
    options?: Array<{
        label: string;
        value: string;
    }>;
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
 * Result of template validation
 */
export interface ValidationResult {
    /** Whether the template is valid */
    valid: boolean;
    /** List of validation errors */
    errors: ValidationError[];
}
/**
 * A single validation error with path and suggestion
 */
export interface ValidationError {
    /** JSON path to the error (e.g., "sections[0].fields[2].key") */
    path: string;
    /** Human-readable error message */
    message: string;
    /** Suggested fix (for model feedback) */
    suggestion?: string;
}
/**
 * Props for the main FusionFragmentRenderer component
 */
export interface FusionFragmentRendererProps {
    /** The template structure (from model) */
    template: FragmentTemplate;
    /** Actual data values to display */
    data: Record<string, unknown>;
    /** Callback for field updates (direct mode) */
    onUpdate?: (key: string, value: unknown) => Promise<void>;
    /** Agent mode configuration */
    agentMode?: {
        enabled: true;
        /** Send message to conversation */
        sendMessage: (message: string) => void;
    };
    /** CSS class name */
    className?: string;
}
/**
 * Props for section renderer
 */
export interface SectionRendererProps {
    /** Section template */
    section: SectionTemplate;
    /** Data for fields */
    data: Record<string, unknown>;
    /** Update callback */
    onUpdate?: (key: string, value: unknown) => Promise<void>;
    /** Agent mode */
    agentMode?: FusionFragmentRendererProps['agentMode'];
}
/**
 * Props for field renderer
 */
export interface FieldRendererProps {
    /** Field template */
    field: FieldTemplate;
    /** Field value from data */
    value: unknown;
    /** Update callback */
    onUpdate?: (value: unknown) => Promise<void>;
    /** Agent mode */
    agentMode?: FusionFragmentRendererProps['agentMode'];
}
/**
 * Props for the injected chart component (matches @vertesia/ui VegaLiteChart)
 */
export interface ChartComponentProps {
    /** The chart specification in VegaLiteChartSpec format */
    spec: {
        library: 'vega-lite';
        title?: string;
        description?: string;
        spec: Record<string, unknown>;
        options?: {
            height?: number;
        };
    };
    /** Optional artifact run ID for resolving artifact: URLs */
    artifactRunId?: string;
}
/**
 * Context value for FusionFragment components
 */
export interface FusionFragmentContextValue {
    /** Data to display */
    data: Record<string, unknown>;
    /** Update callback */
    onUpdate?: (key: string, value: unknown) => Promise<void>;
    /** Send message to agent */
    sendMessage?: (message: string) => void;
    /** Optional chart component to render Vega-Lite charts (injected to avoid circular deps) */
    ChartComponent?: React.ComponentType<ChartComponentProps>;
    /** Optional artifact run ID for resolving artifact references */
    artifactRunId?: string;
}
/**
 * Input for validate_fusion_fragment tool
 */
export interface ValidateFusionFragmentInput {
    /** The template to validate */
    template: FragmentTemplate;
    /** Available data keys */
    dataKeys: string[];
    /** Optional sample data for preview rendering */
    sampleData?: Record<string, unknown>;
    /** Preview mode */
    preview?: 'image' | 'text' | 'none';
}
//# sourceMappingURL=types.d.ts.map