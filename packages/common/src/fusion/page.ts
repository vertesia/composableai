/**
 * Fusion Page Types
 *
 * Types for page templates, layouts, regions, content, and data bindings.
 */

import type { BadgeSpec, ConditionalSpec, IconSpec } from './common.js';

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Page layout types defining the overall structure.
 */
export type PageLayoutType =
    | 'single'          // Single column, full width
    | 'sidebar-left'    // Main content with left sidebar
    | 'sidebar-right'   // Main content with right sidebar
    | 'two-column'      // Two equal columns
    | 'three-column'    // Three columns
    | 'tabs'            // Tabbed interface
    | 'accordion'       // Expandable accordion sections
    | 'dashboard';      // Grid-based dashboard layout

/**
 * Page layout specification.
 */
export interface PageLayoutSpec {
    /** Layout type */
    type: PageLayoutType;
    /** Sidebar width (for sidebar layouts, e.g., '300px', '25%') */
    sidebarWidth?: string;
    /** Column ratios (for multi-column layouts, e.g., [1, 2] for 1:2 ratio) */
    columnRatios?: number[];
    /** Gap between regions */
    gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    /** Padding around the page content */
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    /** Maximum content width */
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Whether to stack on mobile */
    stackOnMobile?: boolean;
    /** Additional layout options */
    options?: {
        /** Sidebar width override */
        sidebarWidth?: string;
        /** Column ratio (e.g., '1:1', '1:2:1') */
        columnRatio?: string;
        /** Gap override as CSS value */
        gap?: string;
        /** Default active tab (for tabs layout) */
        defaultTab?: string;
        /** Allow multiple expanded (for accordion layout) */
        allowMultiple?: boolean;
        /** Default expanded sections (for accordion layout) */
        defaultExpanded?: string[];
    };
}

// ============================================================================
// Region Types
// ============================================================================

/**
 * Page region - a positioned content area within the layout.
 */
export interface PageRegionSpec {
    /** Region identifier (e.g., 'main', 'sidebar', 'header') */
    id: string;
    /** Region title (optional, for visual grouping) */
    title?: string;
    /** Region description */
    description?: string;
    /** Content items within this region */
    content: PageContentSpec[];
    /** Custom CSS class for the region */
    className?: string;
    /** Slot this region belongs to (for layout positioning) */
    slot?: 'main' | 'sidebar' | 'left' | 'right' | 'center' | 'tab' | 'section' | string;
    /** Region visibility condition */
    showIf?: ConditionalSpec;
    /** Legacy condition format (deprecated, use showIf) */
    condition?: {
        field: string;
        operator: 'equals' | 'notEquals' | 'contains' | 'exists' | 'notExists' | 'gt' | 'gte' | 'lt' | 'lte';
        value?: unknown;
    };
    /** Collapsible configuration */
    collapsible?: {
        enabled: boolean;
        defaultCollapsed?: boolean;
    };
    /** Custom style overrides */
    style?: {
        padding?: string;
        background?: string;
        border?: string;
        borderRadius?: string;
    };
}

// ============================================================================
// Content Types
// ============================================================================

/**
 * Content type discriminator.
 */
export type PageContentType =
    | 'fragment'        // Existing FragmentTemplate
    | 'tabs'            // Tabbed content
    | 'list'            // List of items with pagination
    | 'html'            // Raw HTML content
    | 'markdown'        // Markdown content
    | 'component'       // Custom React component reference
    | 'chart'           // Standalone chart
    | 'table'           // Standalone table
    | 'form'            // Interactive form
    | 'empty-state';    // Empty state placeholder

/**
 * Base content specification.
 */
export interface BaseContentSpec {
    /** Unique identifier for this content item */
    id?: string;
    /** Content title (optional) */
    title?: string;
    /** Custom CSS class */
    className?: string;
    /** Visibility condition */
    showIf?: ConditionalSpec;
}

/**
 * Fragment content - renders an existing FragmentTemplate.
 */
export interface FragmentContentSpec extends BaseContentSpec {
    type: 'fragment';
    /** FragmentTemplate definition */
    template: import('./fragment.js').FragmentTemplate;
    /** Data key for the fragment */
    dataKey?: string;
}

/**
 * Tab definition for tabbed content.
 */
export interface TabSpec {
    /** Tab identifier */
    id: string;
    /** Tab label */
    label: string;
    /** Tab icon */
    icon?: IconSpec;
    /** Tab badge */
    badge?: BadgeSpec;
    /** Tab content */
    content: PageContentSpec[];
    /** Tab visibility condition */
    showIf?: ConditionalSpec;
    /** Whether this tab is disabled */
    disabled?: boolean;
}

/**
 * Tabs content - renders tabbed interface.
 */
export interface TabsContentSpec extends BaseContentSpec {
    type: 'tabs';
    /** Tab definitions */
    tabs: TabSpec[];
    /** Default active tab ID */
    defaultTab?: string;
    /** Tab orientation */
    orientation?: 'horizontal' | 'vertical';
    /** Tab style */
    variant?: 'default' | 'pills' | 'underline';
}

/**
 * List item template for list content.
 */
export interface ListItemTemplate {
    /** Primary text key */
    primaryKey: string;
    /** Secondary text key */
    secondaryKey?: string;
    /** Image/avatar key */
    imageKey?: string;
    /** Link href template (supports {{key}} interpolation) */
    href?: string;
    /** Actions for each item */
    actions?: ActionSpec[];
}

/**
 * List content - renders a list of items with optional pagination.
 */
export interface ListContentSpec extends BaseContentSpec {
    type: 'list';
    /** Data key for the list items */
    dataKey: string;
    /** Item template */
    itemTemplate: ListItemTemplate;
    /** Whether to show pagination */
    paginated?: boolean;
    /** Items per page */
    pageSize?: number;
    /** Empty state message */
    emptyMessage?: string;
    /** List style */
    variant?: 'default' | 'cards' | 'compact';
}

/**
 * HTML content - renders raw HTML.
 */
export interface HtmlContentSpec extends BaseContentSpec {
    type: 'html';
    /** Static HTML content */
    html?: string;
    /** Data key for dynamic HTML content */
    dataKey?: string;
}

/**
 * Markdown content - renders markdown.
 */
export interface MarkdownContentSpec extends BaseContentSpec {
    type: 'markdown';
    /** Static markdown content */
    content?: string;
    /** Data key for dynamic markdown content */
    dataKey?: string;
}

/**
 * Component content - references a custom React component.
 */
export interface ComponentContentSpec extends BaseContentSpec {
    type: 'component';
    /** Component name/path */
    component: string;
    /** Props to pass to the component */
    props?: Record<string, unknown>;
    /** Data keys to pass as props */
    dataKeys?: Record<string, string>;
}

/**
 * Chart content - standalone chart.
 */
export interface ChartContentSpec extends BaseContentSpec {
    type: 'chart';
    /** Chart specification (Vega-Lite) */
    spec: Record<string, unknown>;
    /** Data key for chart data */
    dataKey?: string;
    /** Chart height */
    height?: number;
}

/**
 * Table content - standalone table.
 */
export interface TableContentSpec extends BaseContentSpec {
    type: 'table';
    /** Data key for table rows */
    dataKey: string;
    /** Column definitions */
    columns: TableColumnSpec[];
    /** Whether to show search */
    searchable?: boolean;
    /** Whether to show sorting */
    sortable?: boolean;
    /** Whether to show pagination */
    paginated?: boolean;
    /** Rows per page */
    pageSize?: number;
    /** Row actions */
    rowActions?: ActionSpec[];
}

/**
 * Table column specification.
 */
export interface TableColumnSpec {
    /** Column header */
    header: string;
    /** Data key for this column */
    key: string;
    /** Display format */
    format?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean' | 'link' | 'badge';
    /** Column width */
    width?: string;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
    /** Whether this column is sortable */
    sortable?: boolean;
    /** Currency code (for currency format) */
    currency?: string;
    /** Decimal places (for number formats) */
    decimals?: number;
}

/**
 * Form field specification.
 */
export interface FormFieldSpec {
    /** Field name */
    name: string;
    /** Field label */
    label: string;
    /** Field type */
    type: 'text' | 'number' | 'email' | 'password' | 'date' | 'datetime' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'textarea' | 'file';
    /** Placeholder text */
    placeholder?: string;
    /** Whether the field is required */
    required?: boolean;
    /** Default value */
    defaultValue?: unknown;
    /** Options for select/radio fields */
    options?: Array<{ label: string; value: string }>;
    /** Options data key (for dynamic options) */
    optionsKey?: string;
    /** Validation rules */
    validation?: {
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        message?: string;
    };
    /** Field visibility condition */
    showIf?: ConditionalSpec;
}

/**
 * Form content - interactive form.
 */
export interface FormContentSpec extends BaseContentSpec {
    type: 'form';
    /** Form fields */
    fields: FormFieldSpec[];
    /** Submit action */
    submitAction: ActionSpec;
    /** Form layout */
    layout?: 'vertical' | 'horizontal' | 'inline';
    /** Number of columns */
    columns?: 1 | 2 | 3 | 4;
    /** Initial values data key */
    initialValuesKey?: string;
}

/**
 * Empty state content - placeholder when no data.
 */
export interface EmptyStateContentSpec extends BaseContentSpec {
    type: 'empty-state';
    /** Icon to display */
    icon?: IconSpec;
    /** Title text */
    title: string;
    /** Description text */
    description?: string;
    /** Action button */
    action?: ActionSpec;
}

/**
 * Union of all content types.
 */
export type PageContentSpec =
    | FragmentContentSpec
    | TabsContentSpec
    | ListContentSpec
    | HtmlContentSpec
    | MarkdownContentSpec
    | ComponentContentSpec
    | ChartContentSpec
    | TableContentSpec
    | FormContentSpec
    | EmptyStateContentSpec;

// ============================================================================
// Action Types
// ============================================================================

/**
 * Action type discriminator.
 */
export type ActionType =
    | 'navigate'    // Client-side navigation
    | 'api'         // REST API call
    | 'modal'       // Open modal
    | 'agent'       // Trigger agent interaction
    | 'download'    // Download file
    | 'custom';     // Custom handler

/**
 * Base action specification.
 */
export interface BaseActionSpec {
    /** Action identifier */
    id: string;
    /** Button label */
    label: string;
    /** Button icon */
    icon?: IconSpec;
    /** Button variant */
    variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'ghost' | 'link';
    /** Button size */
    size?: 'sm' | 'md' | 'lg';
    /** Whether the action is disabled */
    disabled?: boolean;
    /** Visibility condition */
    showIf?: ConditionalSpec;
    /** Confirmation dialog before executing */
    confirm?: {
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
    };
}

/**
 * Navigate action - client-side navigation.
 */
export interface NavigateActionSpec extends BaseActionSpec {
    type: 'navigate';
    /** Navigation target */
    href: string;
    /** Whether to open in new tab */
    newTab?: boolean;
}

/**
 * API action - REST API call.
 */
export interface ApiActionSpec extends BaseActionSpec {
    type: 'api';
    /** API endpoint */
    endpoint: string;
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Request body (supports {{key}} interpolation) */
    body?: Record<string, unknown>;
    /** Success message */
    successMessage?: string;
    /** Whether to reload data after success */
    reloadOnSuccess?: boolean;
    /** Navigation after success */
    navigateOnSuccess?: string;
}

/**
 * Modal action - open modal.
 */
export interface ModalActionSpec extends BaseActionSpec {
    type: 'modal';
    /** Modal title */
    modalTitle: string;
    /** Modal content */
    modalContent: PageContentSpec[];
    /** Modal size */
    modalSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * Agent action - trigger agent interaction.
 */
export interface AgentActionSpec extends BaseActionSpec {
    type: 'agent';
    /** Message to send to agent */
    message: string;
    /** Interaction ID */
    interactionId?: string;
}

/**
 * Download action - download file.
 */
export interface DownloadActionSpec extends BaseActionSpec {
    type: 'download';
    /** Download URL */
    url: string;
    /** Filename for download */
    filename?: string;
}

/**
 * Custom action - custom handler.
 */
export interface CustomActionSpec extends BaseActionSpec {
    type: 'custom';
    /** Handler name */
    handler: string;
    /** Handler parameters */
    params?: Record<string, unknown>;
}

/**
 * Union of all action types.
 */
export type ActionSpec =
    | NavigateActionSpec
    | ApiActionSpec
    | ModalActionSpec
    | AgentActionSpec
    | DownloadActionSpec
    | CustomActionSpec;

// ============================================================================
// Data Binding Types
// ============================================================================

/**
 * Data source type.
 */
export type DataSourceType =
    | 'contentObject'   // Single content object by ID
    | 'objectQuery'     // Query content objects with filters, return properties
    | 'collection'      // Collection query (deprecated, use objectQuery)
    | 'dataStore'       // SQL query against a DuckDB data store
    | 'artifact'        // Fetch an artifact file (from agent runs, etc.)
    | 'api'             // REST API endpoint
    | 'static'          // Static data
    | 'route';          // Route parameters

/**
 * Query configuration for contentObject source.
 */
export interface ContentObjectQuery {
    /** Object ID (supports {{route.param}} interpolation) */
    id: string;
    /** Properties to select (dot notation for nested, e.g., 'properties.name') */
    select?: string[];
}

/**
 * Query configuration for objectQuery source.
 * Fetches multiple content objects with filters.
 */
export interface ObjectQuerySpec {
    /** MongoDB-style filter (supports {{key}} interpolation) */
    filter?: Record<string, unknown>;
    /** Full-text search query */
    search?: string;
    /** Properties to select (reduces payload size) */
    select?: string[];
    /** Sort configuration */
    sort?: { field: string; direction: 'asc' | 'desc' };
    /** Maximum results */
    limit?: number;
    /** Pagination offset */
    offset?: number;
    /** Filter by content type */
    type?: string;
    /** Filter by status */
    status?: string;
}

/**
 * Query configuration for dataStore source.
 * Executes SQL against a DuckDB data store.
 */
export interface DataStoreQuery {
    /** Data store ID */
    storeId: string;
    /** SQL query (supports {{key}} interpolation for parameters) */
    sql: string;
    /** Maximum rows to return */
    limit?: number;
    /** Query a specific version/snapshot instead of latest */
    versionId?: string;
}

/**
 * Query configuration for artifact source.
 * Fetches file content from project storage.
 */
export interface ArtifactQuery {
    /** Artifact path in storage (supports {{key}} interpolation) */
    path: string;
    /** How to parse the artifact content */
    format?: 'json' | 'text' | 'csv' | 'binary';
    /** For agent artifacts: the run ID */
    runId?: string;
}

/**
 * Query configuration for api source.
 */
export interface ApiQuery {
    /** API endpoint (supports {{key}} interpolation) */
    endpoint: string;
    /** HTTP method */
    method?: 'GET' | 'POST';
    /** Request body for POST (supports {{key}} interpolation) */
    body?: Record<string, unknown>;
    /** Request headers */
    headers?: Record<string, string>;
}

/**
 * Data binding specification.
 */
export interface DataBindingSpec {
    /** Key to store data under (referenced by content via dataKey) */
    key: string;
    /** Data source type */
    source: DataSourceType;

    // Source-specific query configurations (use the appropriate one based on source)

    /** Query for contentObject source */
    contentObject?: ContentObjectQuery;
    /** Query for objectQuery source */
    objectQuery?: ObjectQuerySpec;
    /** Query for dataStore source */
    dataStore?: DataStoreQuery;
    /** Query for artifact source */
    artifact?: ArtifactQuery;
    /** Query for api source */
    api?: ApiQuery;

    /** @deprecated Use source-specific query field instead */
    query?: {
        /** Object ID (for contentObject) */
        id?: string;
        /** Collection ID (for collection) */
        collectionId?: string;
        /** API endpoint (for api) */
        endpoint?: string;
        /** Filter criteria */
        filter?: Record<string, unknown>;
        /** Sort configuration */
        sort?: { field: string; direction: 'asc' | 'desc' };
        /** Limit results */
        limit?: number;
        /** HTTP method (for api) */
        method?: 'GET' | 'POST';
    };

    /** Static data (for static source) */
    data?: unknown;
    /** Transform function name (applied after fetch) */
    transform?: string;
    /** Whether to refetch when window regains focus */
    refetchOnFocus?: boolean;
    /** Polling interval in seconds (0 = disabled) */
    pollingInterval?: number;
    /** Error handling behavior */
    onError?: 'throw' | 'null' | 'empty';
}

// ============================================================================
// Breadcrumb Types
// ============================================================================

/**
 * Breadcrumb specification.
 */
export interface BreadcrumbSpec {
    /** Static label */
    label?: string;
    /** Data key for dynamic label */
    labelKey?: string;
    /** Navigation href */
    href?: string;
    /** Icon */
    icon?: IconSpec;
}

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Permission specification for access control.
 */
export interface PermissionSpec {
    /** Required roles */
    roles?: string[];
    /** Required permissions */
    permissions?: string[];
    /** Custom permission check expression */
    expression?: string;
    /** Fallback behavior when denied */
    fallback?: 'hide' | 'disable' | 'redirect';
    /** Redirect path (for fallback: 'redirect') */
    redirectTo?: string;
}
