/**
 * Fusion JSON Schemas
 *
 * JSON Schema definitions for API payloads and tool inputs.
 * These schemas provide runtime validation for fusion applications and pages.
 *
 * Note: Due to TypeScript limitations with JSONSchemaType and complex union types,
 * these schemas are defined as plain JSON schema objects. They can still be used
 * with AJV for validation - the compile() function will infer types correctly.
 */

// ============================================================================
// Common Schemas
// ============================================================================

export const iconSpecSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['lucide', 'heroicons', 'emoji', 'url', 'custom'] },
        value: { type: 'string' },
        color: { type: 'string', nullable: true },
        size: {
            oneOf: [
                { type: 'string', enum: ['sm', 'md', 'lg'] },
                { type: 'number' },
            ],
            nullable: true,
        },
    },
    required: ['type', 'value'],
    additionalProperties: false,
} as const;

export const logoSpecSchema = {
    type: 'object',
    properties: {
        light: { type: 'string', nullable: true },
        dark: { type: 'string', nullable: true },
        alt: { type: 'string', nullable: true },
        width: { type: 'number', nullable: true },
        height: { type: 'number', nullable: true },
    },
    additionalProperties: false,
} as const;

export const themeSpecSchema = {
    type: 'object',
    properties: {
        primaryColor: { type: 'string', nullable: true },
        accentColor: { type: 'string', nullable: true },
        backgroundColor: { type: 'string', nullable: true },
        textColor: { type: 'string', nullable: true },
        borderRadius: { type: 'string', enum: ['none', 'sm', 'md', 'lg', 'full'], nullable: true },
        logo: { ...logoSpecSchema, nullable: true },
        customCss: { type: 'string', nullable: true },
        fontFamily: { type: 'string', nullable: true },
    },
    additionalProperties: false,
} as const;

export const badgeSpecSchema = {
    type: 'object',
    properties: {
        dataKey: { type: 'string', nullable: true },
        value: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
            nullable: true,
        },
        variant: {
            type: 'string',
            enum: ['default', 'success', 'attention', 'destructive', 'info', 'muted'],
            nullable: true,
        },
        max: { type: 'number', nullable: true },
        showZero: { type: 'boolean', nullable: true },
    },
    additionalProperties: false,
} as const;

export const conditionalSpecSchema = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty', 'hasPermission', 'custom'],
        },
        field: { type: 'string', nullable: true },
        value: { nullable: true }, // any value allowed
        expression: { type: 'string', nullable: true },
    },
    required: ['type'],
    additionalProperties: false,
} as const;

export const permissionSpecSchema = {
    type: 'object',
    properties: {
        roles: { type: 'array', items: { type: 'string' }, nullable: true },
        permissions: { type: 'array', items: { type: 'string' }, nullable: true },
        expression: { type: 'string', nullable: true },
        fallback: { type: 'string', enum: ['hide', 'disable', 'redirect'], nullable: true },
        redirectTo: { type: 'string', nullable: true },
    },
    additionalProperties: false,
} as const;

// ============================================================================
// Fragment Schemas
// ============================================================================

export const fieldTemplateSchema = {
    type: 'object',
    properties: {
        label: { type: 'string' },
        key: { type: 'string' },
        format: {
            type: 'string',
            enum: ['text', 'number', 'currency', 'percent', 'date', 'boolean'],
            nullable: true,
        },
        unit: { type: 'string', nullable: true },
        editable: { type: 'boolean', nullable: true },
        inputType: {
            type: 'string',
            enum: ['text', 'number', 'date', 'select', 'checkbox'],
            nullable: true,
        },
        options: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                },
                required: ['label', 'value'],
                additionalProperties: false,
            },
            nullable: true,
        },
        min: { type: 'number', nullable: true },
        max: { type: 'number', nullable: true },
        highlight: { type: 'string', enum: ['success', 'warning', 'error', 'info'], nullable: true },
        tooltip: { type: 'string', nullable: true },
        decimals: { type: 'number', nullable: true },
        currency: { type: 'string', nullable: true },
    },
    required: ['label', 'key'],
    additionalProperties: false,
} as const;

export const columnTemplateSchema = {
    type: 'object',
    properties: {
        header: { type: 'string' },
        key: { type: 'string' },
        format: {
            type: 'string',
            enum: ['text', 'number', 'currency', 'percent', 'date', 'boolean'],
            nullable: true,
        },
        width: { type: 'string', nullable: true },
        align: { type: 'string', enum: ['left', 'center', 'right'], nullable: true },
        currency: { type: 'string', nullable: true },
        decimals: { type: 'number', nullable: true },
        highlight: { type: 'string', enum: ['success', 'warning', 'error', 'info'], nullable: true },
    },
    required: ['header', 'key'],
    additionalProperties: false,
} as const;

export const vegaLiteSpecSchema = {
    type: 'object',
    properties: {
        $schema: { type: 'string', nullable: true },
        data: {
            type: 'object',
            properties: {
                values: {
                    type: 'array',
                    items: { type: 'object', additionalProperties: true },
                    nullable: true,
                },
                url: { type: 'string', nullable: true },
                format: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['json', 'csv', 'tsv'], nullable: true },
                    },
                    additionalProperties: false,
                    nullable: true,
                },
            },
            additionalProperties: false,
            nullable: true,
        },
        mark: {
            oneOf: [
                { type: 'string' },
                { type: 'object', additionalProperties: true },
            ],
            nullable: true,
        },
        encoding: { type: 'object', additionalProperties: true, nullable: true },
        vconcat: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        hconcat: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        layer: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        transform: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        params: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        config: { type: 'object', additionalProperties: true, nullable: true },
    },
    additionalProperties: true, // Allow additional Vega-Lite properties
} as const;

export const chartTemplateSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        spec: vegaLiteSpecSchema,
        height: { type: 'number', nullable: true },
        width: { type: 'number', nullable: true },
        dataKey: { type: 'string', nullable: true },
    },
    required: ['spec'],
    additionalProperties: false,
} as const;

export const sectionTemplateSchema = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        layout: {
            type: 'string',
            enum: ['grid-2', 'grid-3', 'grid-4', 'list', 'table', 'chart'],
            nullable: true,
        },
        collapsed: { type: 'boolean', nullable: true },
        fields: { type: 'array', items: fieldTemplateSchema, nullable: true },
        columns: { type: 'array', items: columnTemplateSchema, nullable: true },
        dataKey: { type: 'string', nullable: true },
        chart: { ...chartTemplateSchema, nullable: true },
    },
    required: ['title'],
    additionalProperties: false,
} as const;

export const fragmentTemplateSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', nullable: true },
        entityType: {
            type: 'string',
            enum: ['fund', 'scenario', 'portfolio', 'transaction', 'custom'],
            nullable: true,
        },
        sections: { type: 'array', items: sectionTemplateSchema },
        footer: { type: 'string', nullable: true },
    },
    required: ['sections'],
    additionalProperties: false,
} as const;

// ============================================================================
// Page Schemas
// ============================================================================

export const pageLayoutSpecSchema = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['single', 'sidebar-left', 'sidebar-right', 'two-column', 'three-column', 'tabs', 'dashboard'],
        },
        sidebarWidth: { type: 'string', nullable: true },
        columnRatios: { type: 'array', items: { type: 'number' }, nullable: true },
        gap: { type: 'string', enum: ['none', 'sm', 'md', 'lg', 'xl'], nullable: true },
        padding: { type: 'string', enum: ['none', 'sm', 'md', 'lg', 'xl'], nullable: true },
        maxWidth: { type: 'string', enum: ['sm', 'md', 'lg', 'xl', 'full'], nullable: true },
        stackOnMobile: { type: 'boolean', nullable: true },
    },
    required: ['type'],
    additionalProperties: false,
} as const;

export const dataBindingSpecSchema = {
    type: 'object',
    properties: {
        key: { type: 'string' },
        source: {
            type: 'string',
            enum: ['contentObject', 'collection', 'api', 'static', 'route'],
        },
        query: {
            type: 'object',
            properties: {
                id: { type: 'string', nullable: true },
                collectionId: { type: 'string', nullable: true },
                endpoint: { type: 'string', nullable: true },
                filter: { type: 'object', additionalProperties: true, nullable: true },
                sort: {
                    type: 'object',
                    properties: {
                        field: { type: 'string' },
                        direction: { type: 'string', enum: ['asc', 'desc'] },
                    },
                    required: ['field', 'direction'],
                    additionalProperties: false,
                    nullable: true,
                },
                limit: { type: 'number', nullable: true },
                method: { type: 'string', enum: ['GET', 'POST'], nullable: true },
            },
            additionalProperties: false,
            nullable: true,
        },
        data: { nullable: true }, // Any static data
        transform: { type: 'string', nullable: true },
        refetchOnFocus: { type: 'boolean', nullable: true },
        pollingInterval: { type: 'number', nullable: true },
    },
    required: ['key', 'source'],
    additionalProperties: false,
} as const;

export const breadcrumbSpecSchema = {
    type: 'object',
    properties: {
        label: { type: 'string', nullable: true },
        labelKey: { type: 'string', nullable: true },
        href: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
    },
    additionalProperties: false,
} as const;

// Action schema - handles all action types
export const actionSpecSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        type: {
            type: 'string',
            enum: ['navigate', 'api', 'modal', 'agent', 'download', 'custom'],
        },
        icon: { ...iconSpecSchema, nullable: true },
        variant: {
            type: 'string',
            enum: ['default', 'primary', 'secondary', 'destructive', 'ghost', 'link'],
            nullable: true,
        },
        size: { type: 'string', enum: ['sm', 'md', 'lg'], nullable: true },
        disabled: { type: 'boolean', nullable: true },
        showIf: { ...conditionalSpecSchema, nullable: true },
        confirm: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                message: { type: 'string' },
                confirmLabel: { type: 'string', nullable: true },
                cancelLabel: { type: 'string', nullable: true },
            },
            required: ['title', 'message'],
            additionalProperties: false,
            nullable: true,
        },
        // Action-specific properties
        href: { type: 'string', nullable: true },
        newTab: { type: 'boolean', nullable: true },
        endpoint: { type: 'string', nullable: true },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], nullable: true },
        body: { type: 'object', additionalProperties: true, nullable: true },
        successMessage: { type: 'string', nullable: true },
        reloadOnSuccess: { type: 'boolean', nullable: true },
        navigateOnSuccess: { type: 'string', nullable: true },
        modalTitle: { type: 'string', nullable: true },
        modalContent: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        modalSize: { type: 'string', enum: ['sm', 'md', 'lg', 'xl', 'full'], nullable: true },
        message: { type: 'string', nullable: true },
        interactionId: { type: 'string', nullable: true },
        url: { type: 'string', nullable: true },
        filename: { type: 'string', nullable: true },
        handler: { type: 'string', nullable: true },
        params: { type: 'object', additionalProperties: true, nullable: true },
    },
    required: ['id', 'label', 'type'],
    additionalProperties: false,
} as const;

// Page content schema - handles all content types
export const pageContentSpecSchema = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['fragment', 'tabs', 'list', 'html', 'markdown', 'component', 'chart', 'table', 'form', 'empty-state'],
        },
        id: { type: 'string', nullable: true },
        title: { type: 'string', nullable: true },
        className: { type: 'string', nullable: true },
        showIf: { ...conditionalSpecSchema, nullable: true },
        // Type-specific properties
        template: { ...fragmentTemplateSchema, nullable: true },
        dataKey: { type: 'string', nullable: true },
        tabs: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        defaultTab: { type: 'string', nullable: true },
        orientation: { type: 'string', enum: ['horizontal', 'vertical'], nullable: true },
        variant: { type: 'string', nullable: true },
        itemTemplate: { type: 'object', additionalProperties: true, nullable: true },
        paginated: { type: 'boolean', nullable: true },
        pageSize: { type: 'number', nullable: true },
        emptyMessage: { type: 'string', nullable: true },
        html: { type: 'string', nullable: true },
        content: { type: 'string', nullable: true },
        component: { type: 'string', nullable: true },
        props: { type: 'object', additionalProperties: true, nullable: true },
        dataKeys: { type: 'object', additionalProperties: { type: 'string' }, nullable: true },
        spec: { type: 'object', additionalProperties: true, nullable: true },
        height: { type: 'number', nullable: true },
        columns: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        searchable: { type: 'boolean', nullable: true },
        sortable: { type: 'boolean', nullable: true },
        rowActions: { type: 'array', items: actionSpecSchema, nullable: true },
        fields: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        submitAction: { ...actionSpecSchema, nullable: true },
        layout: { type: 'string', enum: ['vertical', 'horizontal', 'inline'], nullable: true },
        initialValuesKey: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
        description: { type: 'string', nullable: true },
        action: { ...actionSpecSchema, nullable: true },
    },
    required: ['type'],
    additionalProperties: false,
} as const;

export const pageRegionSpecSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        title: { type: 'string', nullable: true },
        content: { type: 'array', items: pageContentSpecSchema },
        className: { type: 'string', nullable: true },
        showIf: { ...conditionalSpecSchema, nullable: true },
    },
    required: ['id', 'content'],
    additionalProperties: false,
} as const;

// ============================================================================
// Navigation Schemas
// ============================================================================

// Navigation item - handles all navigation item types
export const navigationItemSpecSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['link', 'group', 'divider', 'action'] },
        id: { type: 'string', nullable: true },
        label: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
        badge: { ...badgeSpecSchema, nullable: true },
        showIf: { ...conditionalSpecSchema, nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
        disabled: { type: 'boolean', nullable: true },
        tooltip: { type: 'string', nullable: true },
        // Link-specific
        href: { type: 'string', nullable: true },
        external: { type: 'boolean', nullable: true },
        target: { type: 'string', enum: ['_blank', '_self'], nullable: true },
        activeMatch: { type: 'string', nullable: true },
        activeMatchExact: { type: 'boolean', nullable: true },
        // Group-specific
        children: { type: 'array', items: { type: 'object', additionalProperties: true }, nullable: true },
        defaultExpanded: { type: 'boolean', nullable: true },
        collapsible: { type: 'boolean', nullable: true },
        // Action-specific
        action: { type: 'string', enum: ['modal', 'agent', 'custom'], nullable: true },
        config: { type: 'object', additionalProperties: true, nullable: true },
    },
    required: ['type'],
    additionalProperties: false,
} as const;

export const navigationSectionSpecSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        title: { type: 'string', nullable: true },
        items: { type: 'array', items: navigationItemSpecSchema },
        showIf: { ...conditionalSpecSchema, nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
        collapsed: { type: 'boolean', nullable: true },
    },
    required: ['id', 'items'],
    additionalProperties: false,
} as const;

export const dynamicNavigationSpecSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        title: { type: 'string', nullable: true },
        dataBinding: dataBindingSpecSchema,
        itemTemplate: {
            type: 'object',
            properties: {
                idKey: { type: 'string' },
                labelKey: { type: 'string' },
                iconKey: { type: 'string', nullable: true },
                hrefTemplate: { type: 'string' },
                badgeKey: { type: 'string', nullable: true },
            },
            required: ['idKey', 'labelKey', 'hrefTemplate'],
            additionalProperties: false,
        },
        maxItems: { type: 'number', nullable: true },
        emptyMessage: { type: 'string', nullable: true },
        viewAllHref: { type: 'string', nullable: true },
        showIf: { ...conditionalSpecSchema, nullable: true },
    },
    required: ['id', 'dataBinding', 'itemTemplate'],
    additionalProperties: false,
} as const;

export const navigationTemplateSchema = {
    type: 'object',
    properties: {
        sidebar: { type: 'array', items: navigationSectionSpecSchema, nullable: true },
        topbar: { type: 'array', items: navigationItemSpecSchema, nullable: true },
        dynamic: { type: 'array', items: dynamicNavigationSpecSchema, nullable: true },
        footer: { type: 'array', items: navigationItemSpecSchema, nullable: true },
        settings: {
            type: 'object',
            properties: {
                sidebarDefaultCollapsed: { type: 'boolean', nullable: true },
                sidebarCollapseBreakpoint: { type: 'string', enum: ['sm', 'md', 'lg', 'xl'], nullable: true },
                showBreadcrumbs: { type: 'boolean', nullable: true },
                highlightActive: { type: 'boolean', nullable: true },
            },
            additionalProperties: false,
            nullable: true,
        },
    },
    additionalProperties: false,
} as const;

// ============================================================================
// Application Schemas
// ============================================================================

export const routeSpecSchema = {
    type: 'object',
    properties: {
        path: { type: 'string' },
        pageId: { type: 'string', nullable: true },
        inlinePage: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                layout: pageLayoutSpecSchema,
                regions: { type: 'array', items: pageRegionSpecSchema },
                dataBindings: { type: 'array', items: dataBindingSpecSchema, nullable: true },
                actions: { type: 'array', items: actionSpecSchema, nullable: true },
                breadcrumbs: { type: 'array', items: breadcrumbSpecSchema, nullable: true },
            },
            required: ['title', 'layout', 'regions'],
            additionalProperties: false,
            nullable: true,
        },
        params: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['string', 'number', 'uuid'], nullable: true },
                    required: { type: 'boolean', nullable: true },
                    default: { type: 'string', nullable: true },
                },
                required: ['name'],
                additionalProperties: false,
            },
            nullable: true,
        },
        requiresAuth: { type: 'boolean', nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
    },
    required: ['path'],
    additionalProperties: false,
} as const;

export const globalDataSourceSpecSchema = {
    type: 'object',
    properties: {
        key: { type: 'string' },
        binding: dataBindingSpecSchema,
        prefetch: { type: 'boolean', nullable: true },
        cacheDuration: { type: 'number', nullable: true },
        requiresAuth: { type: 'boolean', nullable: true },
    },
    required: ['key', 'binding'],
    additionalProperties: false,
} as const;

// ============================================================================
// API Payload Schemas
// ============================================================================

export const createFusionApplicationPayloadSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1, pattern: '^[a-z0-9-]+$' },
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', nullable: true },
        version: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
        navigation: navigationTemplateSchema,
        routes: { type: 'array', items: routeSpecSchema, minItems: 1 },
        defaultRoute: { type: 'string' },
        theme: { ...themeSpecSchema, nullable: true },
        globalDataSources: { type: 'array', items: globalDataSourceSpecSchema, nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
        settingsSchema: { type: 'object', additionalProperties: true, nullable: true },
        settings: { type: 'object', additionalProperties: true, nullable: true },
        tags: { type: 'array', items: { type: 'string' }, nullable: true },
    },
    required: ['name', 'title', 'navigation', 'routes', 'defaultRoute'],
    additionalProperties: false,
} as const;

export const updateFusionApplicationPayloadSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1, pattern: '^[a-z0-9-]+$', nullable: true },
        title: { type: 'string', minLength: 1, nullable: true },
        description: { type: 'string', nullable: true },
        version: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], nullable: true },
        navigation: { ...navigationTemplateSchema, nullable: true },
        routes: { type: 'array', items: routeSpecSchema, nullable: true },
        defaultRoute: { type: 'string', nullable: true },
        theme: { ...themeSpecSchema, nullable: true },
        globalDataSources: { type: 'array', items: globalDataSourceSpecSchema, nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
        settingsSchema: { type: 'object', additionalProperties: true, nullable: true },
        settings: { type: 'object', additionalProperties: true, nullable: true },
        tags: { type: 'array', items: { type: 'string' }, nullable: true },
    },
    additionalProperties: false,
} as const;

export const createFusionPagePayloadSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1, pattern: '^[a-z0-9-]+$' },
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
        path: { type: 'string' },
        layout: pageLayoutSpecSchema,
        regions: { type: 'array', items: pageRegionSpecSchema, minItems: 1 },
        dataBindings: { type: 'array', items: dataBindingSpecSchema, nullable: true },
        actions: { type: 'array', items: actionSpecSchema, nullable: true },
        breadcrumbs: { type: 'array', items: breadcrumbSpecSchema, nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
        meta: {
            type: 'object',
            properties: {
                keywords: { type: 'array', items: { type: 'string' }, nullable: true },
                image: { type: 'string', nullable: true },
            },
            additionalProperties: false,
            nullable: true,
        },
        className: { type: 'string', nullable: true },
        application: { type: 'string', nullable: true },
        tags: { type: 'array', items: { type: 'string' }, nullable: true },
    },
    required: ['name', 'title', 'path', 'layout', 'regions'],
    additionalProperties: false,
} as const;

export const updateFusionPagePayloadSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1, pattern: '^[a-z0-9-]+$', nullable: true },
        title: { type: 'string', minLength: 1, nullable: true },
        description: { type: 'string', nullable: true },
        icon: { ...iconSpecSchema, nullable: true },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], nullable: true },
        path: { type: 'string', nullable: true },
        layout: { ...pageLayoutSpecSchema, nullable: true },
        regions: { type: 'array', items: pageRegionSpecSchema, nullable: true },
        dataBindings: { type: 'array', items: dataBindingSpecSchema, nullable: true },
        actions: { type: 'array', items: actionSpecSchema, nullable: true },
        breadcrumbs: { type: 'array', items: breadcrumbSpecSchema, nullable: true },
        permissions: { ...permissionSpecSchema, nullable: true },
        meta: {
            type: 'object',
            properties: {
                keywords: { type: 'array', items: { type: 'string' }, nullable: true },
                image: { type: 'string', nullable: true },
            },
            additionalProperties: false,
            nullable: true,
        },
        className: { type: 'string', nullable: true },
        application: { type: 'string', nullable: true },
        tags: { type: 'array', items: { type: 'string' }, nullable: true },
    },
    additionalProperties: false,
} as const;

// ============================================================================
// Status Type Schemas
// ============================================================================

export const fusionApplicationStatusSchema = {
    type: 'string',
    enum: ['draft', 'published', 'archived'],
} as const;

export const fusionPageStatusSchema = {
    type: 'string',
    enum: ['draft', 'published', 'archived'],
} as const;
