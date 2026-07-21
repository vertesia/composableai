import type { ViewNavigationNode } from '@vertesia/common';
import { Button, Checkbox, Input, SelectBox } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronRight, Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import type { ViewNavigationRendererProps } from './types.js';

function nextSelection(current: string[], id: string, selected: boolean, multiSelect: boolean | undefined): string[] {
    if (!selected) return current.filter((value) => value !== id);
    if (multiSelect === false) return [id];
    return current.includes(id) ? current : [...current, id];
}

function NodeLabel({ node }: { node: ViewNavigationNode }) {
    return (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate">{node.label}</span>
            <span className="text-xs tabular-nums text-muted">{node.count}</span>
        </span>
    );
}

export function DefaultViewNavigation({
    configuration,
    result,
    isLoading,
    onChange,
    onQueryChange,
}: ViewNavigationRendererProps) {
    const { t } = useUITranslation();
    const idPrefix = useId();
    const presentation =
        configuration.presentation ??
        (configuration.source === 'location' || configuration.source === 'hierarchy' ? 'tree' : 'list');
    const multiSelect = configuration.source === 'hierarchy' ? false : configuration.multi_select;
    const breadcrumbs = result.breadcrumbs ?? [];
    const [draftQuery, setDraftQuery] = useState(result.query ?? '');

    useEffect(() => {
        setDraftQuery(result.query ?? '');
    }, [result.query]);

    const toggle = (id: string, selected: boolean) => {
        onChange(nextSelection(result.selected, id, selected, multiSelect));
    };

    const submitQuery = (event: FormEvent) => {
        event.preventDefault();
        onQueryChange?.(draftQuery.trim());
    };

    return (
        <section className="space-y-2" aria-labelledby={`${idPrefix}-label`}>
            <div className="flex items-center justify-between gap-2">
                <h2 id={`${idPrefix}-label`} className="text-sm font-semibold">
                    {configuration.label}
                </h2>
                {result.selected.length > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => onChange([])}
                        aria-label={`${t('filter.clearAll')}: ${configuration.label}`}
                    >
                        <X className="size-3.5" />
                        {t('filter.clearAll')}
                    </Button>
                )}
            </div>

            {configuration.source === 'collection' && onQueryChange && (
                <form className="flex items-center gap-1" onSubmit={submitQuery}>
                    <Input
                        value={draftQuery}
                        onChange={setDraftQuery}
                        disabled={isLoading}
                        placeholder={t('view.filterNavigation', { label: configuration.label })}
                        aria-label={t('view.filterNavigation', { label: configuration.label })}
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        disabled={isLoading}
                        aria-label={t('view.searchNavigation', { label: configuration.label })}
                    >
                        <Search aria-hidden="true" className="size-4" />
                    </Button>
                </form>
            )}

            {breadcrumbs.length > 0 && (
                <nav aria-label={`${configuration.label} path`}>
                    <ol className="flex flex-wrap items-center gap-1 text-sm">
                        {breadcrumbs.map((node, index) => (
                            <li key={node.id} className="flex items-center gap-1">
                                {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-muted" />}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => onChange([node.id])}
                                    aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                                >
                                    {node.label}
                                </Button>
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            {result.selected.length > 0 &&
                breadcrumbs.length === 0 &&
                (configuration.source === 'location' || configuration.source === 'collection') && (
                    <div className="flex flex-wrap gap-1">
                        {result.selected.map((value) => {
                            const node = result.nodes.find((candidate) => candidate.id === value);
                            const label = node?.label ?? value;
                            return (
                                <Button
                                    key={value}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => toggle(value, false)}
                                    aria-label={t('view.removeSelection', { value: label })}
                                >
                                    {label}
                                    <X aria-hidden="true" className="size-3.5" />
                                </Button>
                            );
                        })}
                    </div>
                )}

            {presentation === 'select' && multiSelect === false ? (
                <SelectBox<ViewNavigationNode>
                    options={result.nodes}
                    value={result.nodes.find((node) => result.selected.includes(node.id))}
                    onChange={(node) => onChange([node.id])}
                    optionLabel={(node) => `${node.label} (${node.count})`}
                    by="id"
                    disabled={isLoading}
                    placeholder={configuration.label}
                    aria-label={configuration.label}
                />
            ) : presentation === 'select' ? (
                <SelectBox<ViewNavigationNode>
                    multiple
                    options={result.nodes}
                    value={result.nodes.filter((node) => result.selected.includes(node.id))}
                    onChange={(nodes) => onChange(nodes.map((node) => node.id))}
                    optionLabel={(node) => `${node.label} (${node.count})`}
                    by="id"
                    disabled={isLoading}
                    placeholder={configuration.label}
                    aria-label={configuration.label}
                />
            ) : presentation === 'chips' ? (
                <div className="flex flex-wrap gap-2">
                    {result.nodes.map((node) => (
                        <Button
                            type="button"
                            variant={result.selected.includes(node.id) ? 'secondary' : 'outline'}
                            size="sm"
                            key={node.id}
                            disabled={isLoading}
                            onClick={() => toggle(node.id, !result.selected.includes(node.id))}
                        >
                            {node.label}
                            <span className="text-xs tabular-nums text-muted">{node.count}</span>
                        </Button>
                    ))}
                </div>
            ) : configuration.source === 'hierarchy' ? (
                <div className="space-y-1">
                    {result.nodes.map((node) => (
                        <Button
                            type="button"
                            variant={result.selected.includes(node.id) ? 'secondary' : 'ghost'}
                            className="w-full justify-start"
                            key={node.id}
                            disabled={isLoading}
                            onClick={() => onChange([node.id])}
                        >
                            <NodeLabel node={node} />
                            {node.expandable && (
                                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                            )}
                        </Button>
                    ))}
                </div>
            ) : (
                <div className="space-y-1">
                    {result.nodes.map((node, index) => {
                        const nodeId = `${idPrefix}-${index}`;
                        return (
                            <div
                                key={node.id}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                            >
                                <Checkbox
                                    id={nodeId}
                                    checked={result.selected.includes(node.id)}
                                    disabled={isLoading}
                                    onCheckedChange={(checked) => toggle(node.id, checked === true)}
                                />
                                <label htmlFor={nodeId} className="flex min-w-0 flex-1 cursor-pointer text-sm">
                                    <NodeLabel node={node} />
                                </label>
                            </div>
                        );
                    })}
                </div>
            )}

            {result.nodes.length === 0 && <p className="text-sm text-muted">{t('filter.noAvailableFilters')}</p>}
        </section>
    );
}
