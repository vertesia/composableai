import type { ViewNavigationNode } from '@vertesia/common';
import { Badge, Button, Checkbox, SelectBox } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronRight, X } from 'lucide-react';
import { useId } from 'react';
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

export function DefaultViewNavigation({ configuration, result, isLoading, onChange }: ViewNavigationRendererProps) {
    const { t } = useUITranslation();
    const idPrefix = useId();
    const presentation =
        configuration.presentation ??
        (configuration.source === 'location' || configuration.source === 'hierarchy' ? 'tree' : 'list');
    const multiSelect = configuration.source === 'hierarchy' ? false : configuration.multi_select;
    const breadcrumbs = result.breadcrumbs ?? [];

    const toggle = (id: string, selected: boolean) => {
        onChange(nextSelection(result.selected, id, selected, multiSelect));
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

            {configuration.source === 'hierarchy' && breadcrumbs.length > 0 && (
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
                (configuration.source === 'location' || configuration.source === 'collection') && (
                    <div className="flex flex-wrap gap-1">
                        {result.selected.map((value) => {
                            const node = result.nodes.find((candidate) => candidate.id === value);
                            return (
                                <Badge key={value} variant="secondary">
                                    {node?.label ?? value}
                                </Badge>
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
