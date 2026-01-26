/**
 * Content Renderer
 *
 * Renders different content types within a page region.
 * Supports fragment, tabs, list, html, markdown, component, chart, table, form, empty-state.
 */

import React from 'react';
import type {
    PageContentSpec,
    FragmentContentSpec,
    TabsContentSpec,
    ListContentSpec,
    HtmlContentSpec,
    MarkdownContentSpec,
    ChartContentSpec,
    TableContentSpec,
    FormContentSpec,
    EmptyStateContentSpec,
    ConditionalSpec,
} from '@vertesia/common';
import type { ContentRendererProps } from './types.js';
import { useFusionPageContext } from './FusionPageContext.js';
import { FusionFragmentRenderer } from '../fusion-fragment/index.js';

/**
 * Evaluate a conditional spec against data.
 */
function evaluateCondition(
    condition: ConditionalSpec | undefined,
    data: Record<string, unknown>
): boolean {
    if (!condition) return true;

    const { type, field, value } = condition;

    // If no field, can't evaluate (except for custom expressions)
    if (!field && type !== 'custom') {
        return true;
    }

    // Get field value if field is specified
    let fieldValue: unknown = undefined;
    if (field) {
        const keys = field.split('.');
        fieldValue = data;
        for (const key of keys) {
            if (fieldValue && typeof fieldValue === 'object') {
                fieldValue = (fieldValue as Record<string, unknown>)[key];
            } else {
                fieldValue = undefined;
                break;
            }
        }
    }

    switch (type) {
        case 'equals':
            return fieldValue === value;
        case 'notEquals':
            return fieldValue !== value;
        case 'contains':
            if (Array.isArray(fieldValue)) return fieldValue.includes(value);
            if (typeof fieldValue === 'string') return fieldValue.includes(String(value));
            return false;
        case 'isEmpty':
            return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
                (Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'isNotEmpty':
            return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
                !(Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'greaterThan':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
        case 'lessThan':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
        case 'hasPermission':
            // Permission checking should be handled by the application
            return true;
        case 'custom':
            // Custom expressions should be handled by the application
            return true;
        default:
            return true;
    }
}

/**
 * Get a value from data by key path (dot notation).
 */
function getDataValue<T>(data: Record<string, unknown>, key: string): T | undefined {
    const keys = key.split('.');
    let value: unknown = data;
    for (const k of keys) {
        if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[k];
        } else {
            return undefined;
        }
    }
    return value as T;
}

/**
 * Render fragment content.
 */
function FragmentContent({
    content,
    data,
}: {
    content: FragmentContentSpec;
    data: Record<string, unknown>;
}) {
    const { onUpdate } = useFusionPageContext();
    const fragmentData = content.dataKey ? getDataValue<Record<string, unknown>>(data, content.dataKey) || {} : data;

    // Wrap onUpdate to return Promise<void> as expected by FusionFragmentRenderer
    const handleUpdate = onUpdate
        ? async (key: string, value: unknown): Promise<void> => { onUpdate(key, value); }
        : undefined;

    return (
        <FusionFragmentRenderer
            template={content.template}
            data={fragmentData}
            onUpdate={handleUpdate}
            className={content.className}
        />
    );
}

/**
 * Render tabbed content.
 */
function TabsContent({
    content,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: ContentRendererProps & { content: TabsContentSpec }) {
    const [activeTab, setActiveTab] = React.useState(content.defaultTab || content.tabs[0]?.id);

    const visibleTabs = content.tabs.filter((tab) => evaluateCondition(tab.showIf, data));

    return (
        <div
            className={`fusion-content-tabs fusion-tabs-${content.orientation || 'horizontal'} fusion-tabs-${content.variant || 'default'} ${content.className || ''}`}
        >
            <div className="fusion-tabs-list" role="tablist">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-disabled={tab.disabled}
                        disabled={tab.disabled}
                        className={`fusion-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    >
                        {tab.label}
                        {tab.badge && (
                            <span className={`fusion-tab-badge fusion-badge-${tab.badge.variant || 'default'}`}>
                                {tab.badge.value}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            <div className="fusion-tabs-panels">
                {visibleTabs.map((tab) => (
                    <div
                        key={tab.id}
                        role="tabpanel"
                        hidden={activeTab !== tab.id}
                        className="fusion-tab-panel"
                    >
                        {activeTab === tab.id &&
                            tab.content.map((item, idx) => (
                                <ContentRenderer
                                    key={item.id || `tab-content-${idx}`}
                                    content={item}
                                    data={data}
                                    context={context}
                                    onAction={onAction}
                                    onUpdate={onUpdate}
                                    onNavigate={onNavigate}
                                />
                            ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Render list content.
 */
function ListContent({
    content,
    data,
    onNavigate,
}: ContentRendererProps & { content: ListContentSpec }) {
    const items = getDataValue<unknown[]>(data, content.dataKey) || [];
    const [page, setPage] = React.useState(0);
    const pageSize = content.pageSize || 10;

    const paginatedItems = content.paginated
        ? items.slice(page * pageSize, (page + 1) * pageSize)
        : items;

    const totalPages = Math.ceil(items.length / pageSize);

    if (items.length === 0) {
        return (
            <div className={`fusion-content-list fusion-list-empty ${content.className || ''}`}>
                {content.emptyMessage || 'No items found'}
            </div>
        );
    }

    const handleItemClick = (item: unknown) => {
        if (content.itemTemplate.href && onNavigate) {
            const href = content.itemTemplate.href.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
                return String((item as Record<string, unknown>)[key.trim()] ?? '');
            });
            onNavigate(href);
        }
    };

    return (
        <div className={`fusion-content-list fusion-list-${content.variant || 'default'} ${content.className || ''}`}>
            <ul className="fusion-list-items">
                {paginatedItems.map((item, index) => {
                    const itemRecord = item as Record<string, unknown>;
                    const primary = getDataValue<string>(itemRecord, content.itemTemplate.primaryKey);
                    const secondary = content.itemTemplate.secondaryKey
                        ? getDataValue<string>(itemRecord, content.itemTemplate.secondaryKey)
                        : undefined;
                    const image = content.itemTemplate.imageKey
                        ? getDataValue<string>(itemRecord, content.itemTemplate.imageKey)
                        : undefined;

                    return (
                        <li
                            key={index}
                            className={`fusion-list-item ${content.itemTemplate.href ? 'clickable' : ''}`}
                            onClick={() => content.itemTemplate.href && handleItemClick(item)}
                        >
                            {image && (
                                <img
                                    src={image}
                                    alt=""
                                    className="fusion-list-item-image"
                                />
                            )}
                            <div className="fusion-list-item-content">
                                <span className="fusion-list-item-primary">{primary}</span>
                                {secondary && (
                                    <span className="fusion-list-item-secondary">{secondary}</span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {content.paginated && totalPages > 1 && (
                <div className="fusion-list-pagination">
                    <button
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </button>
                    <span>
                        Page {page + 1} of {totalPages}
                    </span>
                    <button
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Render HTML content.
 */
function HtmlContent({
    content,
    data,
}: {
    content: HtmlContentSpec;
    data: Record<string, unknown>;
}) {
    const html = content.dataKey
        ? getDataValue<string>(data, content.dataKey) || ''
        : content.html || '';

    return (
        <div
            className={`fusion-content-html ${content.className || ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

/**
 * Render markdown content.
 * Note: Actual markdown rendering should be done by the application
 * using a markdown library like react-markdown.
 */
function MarkdownContent({
    content,
    data,
}: {
    content: MarkdownContentSpec;
    data: Record<string, unknown>;
}) {
    const markdown = content.dataKey
        ? getDataValue<string>(data, content.dataKey) || ''
        : content.content || '';

    // Simple markdown: just render as preformatted text
    // Applications should override this with proper markdown rendering
    return (
        <div className={`fusion-content-markdown ${content.className || ''}`}>
            <pre>{markdown}</pre>
        </div>
    );
}

/**
 * Render chart content.
 */
function ChartContent({
    content,
    data,
}: {
    content: ChartContentSpec;
    data: Record<string, unknown>;
}) {
    const chartData = content.dataKey ? getDataValue(data, content.dataKey) : undefined;

    // Merge data into spec if provided
    const spec = chartData
        ? { ...content.spec, data: { values: chartData } }
        : content.spec;

    return (
        <div
            className={`fusion-content-chart ${content.className || ''}`}
            style={{ height: content.height || 300 }}
        >
            {/* Chart rendering should be handled by the application */}
            <div
                className="fusion-chart-container"
                data-spec={JSON.stringify(spec)}
            >
                <span className="fusion-chart-placeholder">
                    Chart (Vega-Lite spec provided)
                </span>
            </div>
        </div>
    );
}

/**
 * Format a cell value based on column format.
 */
function formatCellValue(
    value: unknown,
    column: { format?: string; currency?: string; decimals?: number }
): string {
    if (value === null || value === undefined) return '';

    switch (column.format) {
        case 'number':
            return typeof value === 'number'
                ? value.toLocaleString(undefined, {
                      minimumFractionDigits: column.decimals,
                      maximumFractionDigits: column.decimals,
                  })
                : String(value);
        case 'currency':
            return typeof value === 'number'
                ? value.toLocaleString(undefined, {
                      style: 'currency',
                      currency: column.currency || 'USD',
                      minimumFractionDigits: column.decimals ?? 2,
                      maximumFractionDigits: column.decimals ?? 2,
                  })
                : String(value);
        case 'percent':
            return typeof value === 'number'
                ? `${(value * 100).toFixed(column.decimals ?? 1)}%`
                : String(value);
        case 'date':
            return value instanceof Date
                ? value.toLocaleDateString()
                : typeof value === 'string'
                ? new Date(value).toLocaleDateString()
                : String(value);
        case 'boolean':
            return value ? 'Yes' : 'No';
        default:
            return String(value);
    }
}

/**
 * Render table content.
 */
function TableContent({
    content,
    data,
}: {
    content: TableContentSpec;
    data: Record<string, unknown>;
}) {
    const rows = getDataValue<unknown[]>(data, content.dataKey) || [];
    const [searchTerm, setSearchTerm] = React.useState('');
    const [sortConfig, setSortConfig] = React.useState<{
        key: string;
        direction: 'asc' | 'desc';
    } | null>(null);
    const [page, setPage] = React.useState(0);
    const pageSize = content.pageSize || 10;

    // Filter rows by search
    const filteredRows = content.searchable && searchTerm
        ? rows.filter((row) => {
              const rowRecord = row as Record<string, unknown>;
              return content.columns.some((col) => {
                  const value = getDataValue(rowRecord, col.key);
                  return String(value ?? '')
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase());
              });
          })
        : rows;

    // Sort rows
    const sortedRows = sortConfig
        ? [...filteredRows].sort((a, b) => {
              const aValue = getDataValue(a as Record<string, unknown>, sortConfig.key);
              const bValue = getDataValue(b as Record<string, unknown>, sortConfig.key);
              const comparison = String(aValue ?? '').localeCompare(String(bValue ?? ''));
              return sortConfig.direction === 'asc' ? comparison : -comparison;
          })
        : filteredRows;

    // Paginate rows
    const paginatedRows = content.paginated
        ? sortedRows.slice(page * pageSize, (page + 1) * pageSize)
        : sortedRows;

    const totalPages = Math.ceil(sortedRows.length / pageSize);

    const handleSort = (key: string) => {
        if (!content.sortable) return;
        setSortConfig((prev) =>
            prev?.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'asc' }
        );
    };

    return (
        <div className={`fusion-content-table ${content.className || ''}`}>
            {content.searchable && (
                <div className="fusion-table-search">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}
            <table className="fusion-table">
                <thead>
                    <tr>
                        {content.columns.map((col) => (
                            <th
                                key={col.key}
                                style={{
                                    width: col.width,
                                    textAlign: col.align,
                                    cursor: col.sortable !== false && content.sortable ? 'pointer' : undefined,
                                }}
                                onClick={() => col.sortable !== false && handleSort(col.key)}
                            >
                                {col.header}
                                {sortConfig?.key === col.key && (
                                    <span className="fusion-table-sort-indicator">
                                        {sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}
                                    </span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {paginatedRows.map((row, rowIndex) => {
                        const rowRecord = row as Record<string, unknown>;
                        return (
                            <tr key={rowIndex}>
                                {content.columns.map((col) => {
                                    const value = getDataValue(rowRecord, col.key);
                                    return (
                                        <td
                                            key={col.key}
                                            style={{ textAlign: col.align }}
                                        >
                                            {formatCellValue(value, col)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {content.paginated && totalPages > 1 && (
                <div className="fusion-table-pagination">
                    <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                        Previous
                    </button>
                    <span>
                        Page {page + 1} of {totalPages}
                    </span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Render form content.
 */
function FormContent({
    content,
    data,
    onAction,
}: ContentRendererProps & { content: FormContentSpec }) {
    const initialValues = content.initialValuesKey
        ? getDataValue<Record<string, unknown>>(data, content.initialValuesKey) || {}
        : {};

    const [formData, setFormData] = React.useState<Record<string, unknown>>(initialValues);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const handleFieldChange = (name: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Clear error on change
        if (errors[name]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        for (const field of content.fields) {
            const value = formData[field.name];

            if (field.required && (value === undefined || value === null || value === '')) {
                newErrors[field.name] = `${field.label} is required`;
                continue;
            }

            if (field.validation && value) {
                const { min, max, minLength, maxLength, pattern, message } = field.validation;

                if (typeof value === 'number') {
                    if (min !== undefined && value < min) {
                        newErrors[field.name] = message || `Minimum value is ${min}`;
                    }
                    if (max !== undefined && value > max) {
                        newErrors[field.name] = message || `Maximum value is ${max}`;
                    }
                }

                if (typeof value === 'string') {
                    if (minLength !== undefined && value.length < minLength) {
                        newErrors[field.name] = message || `Minimum length is ${minLength}`;
                    }
                    if (maxLength !== undefined && value.length > maxLength) {
                        newErrors[field.name] = message || `Maximum length is ${maxLength}`;
                    }
                    if (pattern && !new RegExp(pattern).test(value)) {
                        newErrors[field.name] = message || 'Invalid format';
                    }
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        if (onAction) {
            onAction(content.submitAction, formData);
        }
    };

    const visibleFields = content.fields.filter((field) =>
        evaluateCondition(field.showIf, { ...data, ...formData })
    );

    return (
        <form
            className={`fusion-content-form fusion-form-${content.layout || 'vertical'} ${content.className || ''}`}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${content.columns || 1}, 1fr)`,
                gap: '1rem',
            }}
            onSubmit={handleSubmit}
        >
            {visibleFields.map((field) => {
                const options = field.optionsKey
                    ? getDataValue<Array<{ label: string; value: string }>>(data, field.optionsKey) || []
                    : field.options || [];

                return (
                    <div key={field.name} className="fusion-form-field">
                        <label className="fusion-form-label">
                            {field.label}
                            {field.required && <span className="fusion-form-required">*</span>}
                        </label>
                        {renderFormInput(field, formData[field.name], options, handleFieldChange)}
                        {errors[field.name] && (
                            <span className="fusion-form-error">{errors[field.name]}</span>
                        )}
                    </div>
                );
            })}
            <div className="fusion-form-actions">
                <button type="submit" className="fusion-form-submit">
                    {content.submitAction.label}
                </button>
            </div>
        </form>
    );
}

/**
 * Render a form input based on field type.
 */
function renderFormInput(
    field: FormContentSpec['fields'][0],
    value: unknown,
    options: Array<{ label: string; value: string }>,
    onChange: (name: string, value: unknown) => void
): React.ReactNode {
    const commonProps = {
        name: field.name,
        placeholder: field.placeholder,
        required: field.required,
    };

    switch (field.type) {
        case 'text':
        case 'email':
        case 'password':
            return (
                <input
                    {...commonProps}
                    type={field.type}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(field.name, e.target.value)}
                />
            );
        case 'number':
            return (
                <input
                    {...commonProps}
                    type="number"
                    value={value !== undefined ? Number(value) : ''}
                    onChange={(e) => onChange(field.name, e.target.valueAsNumber)}
                />
            );
        case 'date':
        case 'datetime':
            return (
                <input
                    {...commonProps}
                    type={field.type === 'datetime' ? 'datetime-local' : 'date'}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(field.name, e.target.value)}
                />
            );
        case 'textarea':
            return (
                <textarea
                    {...commonProps}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(field.name, e.target.value)}
                />
            );
        case 'select':
            return (
                <select
                    {...commonProps}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(field.name, e.target.value)}
                >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            );
        case 'multiselect':
            return (
                <select
                    {...commonProps}
                    multiple
                    value={Array.isArray(value) ? value.map(String) : []}
                    onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                        onChange(field.name, selected);
                    }}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            );
        case 'checkbox':
            return (
                <input
                    type="checkbox"
                    name={field.name}
                    checked={Boolean(value)}
                    onChange={(e) => onChange(field.name, e.target.checked)}
                />
            );
        case 'radio':
            return (
                <div className="fusion-form-radio-group">
                    {options.map((opt) => (
                        <label key={opt.value} className="fusion-form-radio">
                            <input
                                type="radio"
                                name={field.name}
                                value={opt.value}
                                checked={value === opt.value}
                                onChange={() => onChange(field.name, opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            );
        default:
            return (
                <input
                    {...commonProps}
                    type="text"
                    value={String(value ?? '')}
                    onChange={(e) => onChange(field.name, e.target.value)}
                />
            );
    }
}

/**
 * Render empty state content.
 */
function EmptyStateContent({
    content,
    onAction,
}: {
    content: EmptyStateContentSpec;
    onAction?: ContentRendererProps['onAction'];
}) {
    return (
        <div className={`fusion-content-empty-state ${content.className || ''}`}>
            {content.icon && (
                <span className="fusion-empty-state-icon">{content.icon.value}</span>
            )}
            <h3 className="fusion-empty-state-title">{content.title}</h3>
            {content.description && (
                <p className="fusion-empty-state-description">{content.description}</p>
            )}
            {content.action && onAction && (
                <button
                    className="fusion-empty-state-action"
                    onClick={() => onAction(content.action!)}
                >
                    {content.action.label}
                </button>
            )}
        </div>
    );
}

/**
 * Main content renderer component.
 * Dispatches to specific content type renderers.
 */
export function ContentRenderer(props: ContentRendererProps) {
    const { content, data, context, className, onAction, onUpdate, onNavigate } = props;

    // Get renderers from context (must be called unconditionally for React rules)
    const { renderers } = useFusionPageContext();

    // Check visibility condition
    if (!evaluateCondition(content.showIf, data)) {
        return null;
    }

    // Render based on content type
    switch (content.type) {
        case 'fragment':
            return <FragmentContent content={content as FragmentContentSpec} data={data} />;
        case 'tabs':
            return (
                <TabsContent
                    content={content as TabsContentSpec}
                    data={data}
                    context={context}
                    onAction={onAction}
                    onUpdate={onUpdate}
                    onNavigate={onNavigate}
                />
            );
        case 'list':
            return (
                <ListContent
                    content={content as ListContentSpec}
                    data={data}
                    context={context}
                    onAction={onAction}
                    onUpdate={onUpdate}
                    onNavigate={onNavigate}
                />
            );
        case 'html':
            return <HtmlContent content={content as HtmlContentSpec} data={data} />;
        case 'markdown':
            return <MarkdownContent content={content as MarkdownContentSpec} data={data} />;
        case 'component': {
            // Custom components should be registered via ContentRendererRegistry
            const CustomComponent = renderers?.get(content.component);
            if (CustomComponent) {
                return <CustomComponent {...props} />;
            }
            return (
                <div className={`fusion-content-component-missing ${className || ''}`}>
                    Component "{content.component}" not found
                </div>
            );
        }
        case 'chart':
            return <ChartContent content={content as ChartContentSpec} data={data} />;
        case 'table':
            return <TableContent content={content as TableContentSpec} data={data} />;
        case 'form':
            return (
                <FormContent
                    content={content as FormContentSpec}
                    data={data}
                    context={context}
                    onAction={onAction}
                    onUpdate={onUpdate}
                    onNavigate={onNavigate}
                />
            );
        case 'empty-state':
            return <EmptyStateContent content={content as EmptyStateContentSpec} onAction={onAction} />;
        default:
            return (
                <div className={`fusion-content-unknown ${className || ''}`}>
                    Unknown content type: {(content as PageContentSpec).type}
                </div>
            );
    }
}
