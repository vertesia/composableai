import type { VertesiaClient } from '@vertesia/client';
import type {
    ExecuteViewRequest,
    ViewActionConfiguration,
    ViewExecutionDefinition,
    ViewExecutionResult,
    ViewHit,
} from '@vertesia/common';
import {
    Button,
    Checkbox,
    ConfirmModal,
    Popover,
    PopoverContent,
    PopoverTrigger,
    SelectList,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Download, EllipsisVertical, Trash2, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { ExportPropertiesModal } from '../store/objects/ExportPropertiesModal.js';
import type {
    ViewActionContext,
    ViewActionContribution,
    ViewExperienceContributions,
    ViewSelectionController,
} from './types.js';

interface PendingAction {
    action: ViewActionConfiguration;
    hits: ViewHit[];
}

interface ViewActionsRuntime {
    actions: ViewActionConfiguration[];
    runningActionId?: string;
    run: (action: ViewActionConfiguration, hits: ViewHit[]) => void;
}

const ViewActionsContext = createContext<ViewActionsRuntime | undefined>(undefined);

export function useViewActions(): ViewActionsRuntime | undefined {
    return useContext(ViewActionsContext);
}

interface ViewActionsProviderProps {
    children: ReactNode;
    definition: ViewExecutionDefinition;
    request: ExecuteViewRequest;
    result: ViewExecutionResult;
    selection?: ViewSelectionController;
    contributions?: ViewExperienceContributions;
    client?: VertesiaClient;
    canDelete: boolean;
    refresh: () => Promise<void>;
}

function selectionMatches(action: ViewActionConfiguration, hits: ViewHit[]): boolean {
    const requirement = action.requires_selection ?? (action.placement === 'toolbar' ? 'none' : 'any');
    if (requirement === 'none') return true;
    if (requirement === 'single') return hits.length === 1;
    if (requirement === 'multiple') return hits.length > 1;
    return hits.length > 0;
}

function triggerDownload(response: { type: string; name: string; data: string }): void {
    const url = window.URL.createObjectURL(new Blob([response.data], { type: response.type }));
    const anchor = document.createElement('a');
    anchor.download = response.name;
    anchor.href = url;
    anchor.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

export function ViewActionsProvider({
    children,
    definition,
    request,
    result,
    selection,
    contributions,
    client,
    canDelete,
    refresh,
}: ViewActionsProviderProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [pending, setPending] = useState<PendingAction>();
    const [exportHits, setExportHits] = useState<ViewHit[]>();
    const [isExporting, setIsExporting] = useState(false);
    const [runningActionId, setRunningActionId] = useState<string>();
    const runningActionRef = useRef(false);
    const actionsConfiguration = definition.results?.actions;

    const baseContext = useMemo<Omit<ViewActionContext, 'action' | 'hits'>>(
        () => ({
            definition,
            request,
            result,
            refresh,
            clearSelection: () => selection?.clear(),
        }),
        [definition, refresh, request, result, selection],
    );

    const actions = useMemo(() => {
        const configured = (actionsConfiguration?.items ?? []).filter((action) => {
            const contribution = contributions?.actions?.[action.handler];
            return contribution !== undefined && (contribution.isAvailable?.(baseContext) ?? true);
        });
        if (!selection || actionsConfiguration?.include_defaults === false || !client) return configured;

        const excluded = new Set(actionsConfiguration?.exclude_defaults ?? []);
        const defaults: ViewActionConfiguration[] = [];
        if (!excluded.has('export')) {
            defaults.push({
                id: 'export',
                label: t('store.actions.exportProperties'),
                handler: 'export',
                placement: 'selection',
                requires_selection: 'any',
            });
        }
        if (canDelete && !excluded.has('delete')) {
            defaults.push({
                id: 'delete',
                label: t('store.actions.delete'),
                handler: 'delete',
                placement: 'selection',
                requires_selection: 'any',
                destructive: true,
                confirm: true,
            });
        }
        return [...defaults, ...configured];
    }, [actionsConfiguration, baseContext, canDelete, client, contributions?.actions, selection, t]);

    const execute = useCallback(
        async ({ action, hits }: PendingAction) => {
            if (runningActionRef.current) return;
            runningActionRef.current = true;
            setRunningActionId(action.id);
            try {
                if (action.handler === 'delete') {
                    if (!client) return;
                    const response = await client.store.objects.delete(hits.map((hit) => hit.id));
                    toast({
                        status: response.failed.length > 0 ? 'warning' : 'success',
                        title: t('view.deletedObjects', { count: response.deleted }),
                    });
                    selection?.clear();
                    await refresh();
                    return;
                }

                const contribution: ViewActionContribution | undefined = contributions?.actions?.[action.handler];
                if (!contribution) return;
                await contribution.run({ ...baseContext, action, hits });
            } catch (error: unknown) {
                console.error('View action failed:', error);
                toast({
                    status: 'error',
                    title: t('view.actionFailed'),
                    description: t('view.actionFailedDescription'),
                });
            } finally {
                runningActionRef.current = false;
                setRunningActionId(undefined);
                setPending(undefined);
            }
        },
        [baseContext, client, contributions?.actions, refresh, selection, t, toast],
    );

    const run = useCallback(
        (action: ViewActionConfiguration, hits: ViewHit[]) => {
            if (!selectionMatches(action, hits) || runningActionRef.current) return;
            if (action.handler === 'export') {
                setExportHits(hits);
                return;
            }
            if (action.confirm) {
                setPending({ action, hits });
                return;
            }
            void execute({ action, hits });
        },
        [execute],
    );

    const closeExport = useCallback(
        (format?: string | null) => {
            if (!format || !exportHits?.length || !client) {
                setExportHits(undefined);
                return;
            }
            setIsExporting(true);
            void client.store.objects
                .exportProperties({ objectIds: exportHits.map((hit) => hit.id), type: format })
                .then((response) => {
                    triggerDownload(response);
                    toast({ status: 'success', title: t('store.actions.exportProperties') });
                    setExportHits(undefined);
                })
                .catch((error: unknown) => {
                    console.error('View export failed:', error);
                    toast({
                        status: 'error',
                        title: t('store.actions.errorExportProperties'),
                        description: t('view.actionFailedDescription'),
                    });
                })
                .finally(() => setIsExporting(false));
        },
        [client, exportHits, t, toast],
    );

    const value = useMemo<ViewActionsRuntime>(
        () => ({ actions, runningActionId, run }),
        [actions, run, runningActionId],
    );

    return (
        <ViewActionsContext.Provider value={value}>
            {children}
            <ExportPropertiesModal
                isOpen={exportHits !== undefined}
                isExporting={isExporting}
                onClose={closeExport}
                allowExportAll={false}
            />
            <ConfirmModal
                isOpen={pending !== undefined}
                title={pending?.action.label ?? t('modal.confirm')}
                content={t('view.confirmAction', {
                    action: pending?.action.label ?? '',
                    count: pending?.hits.length ?? 0,
                })}
                isLoading={runningActionId !== undefined}
                onConfirm={() => {
                    if (pending) void execute(pending);
                }}
                onCancel={() => setPending(undefined)}
                confirmationValue={pending?.action.handler === 'delete' ? 'delete' : undefined}
                confirmationLabel={pending?.action.handler === 'delete' ? t('view.typeDeleteToConfirm') : undefined}
                confirmationPlaceholder={pending?.action.handler === 'delete' ? 'delete' : undefined}
            />
        </ViewActionsContext.Provider>
    );
}

export function ViewActionsToolbar({
    selection,
    page,
    showSelectPage = false,
}: {
    selection?: ViewSelectionController;
    page: ViewHit[];
    showSelectPage?: boolean;
}) {
    const { t } = useUITranslation();
    const runtime = useViewActions();
    const selectPageId = useId();
    if (!runtime) return null;
    const selected = selection?.selectedHits ?? [];
    const selectedOnPage = selection ? page.filter((hit) => selection.isSelected(hit.id)).length : 0;
    const allOnPageSelected = page.length > 0 && selectedOnPage === page.length;
    const canSelectPage = showSelectPage && selection?.selectAll && page.length > 0;
    const actions = runtime.actions.filter(
        (action) =>
            ((action.placement ?? 'selection') === 'toolbar' ||
                ((action.placement ?? 'selection') === 'selection' && selected.length > 0)) &&
            selectionMatches(action, selected),
    );
    if (actions.length === 0 && selected.length === 0 && !canSelectPage) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {canSelectPage && selection && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={selectPageId}
                        checked={allOnPageSelected ? true : selectedOnPage > 0 ? 'indeterminate' : false}
                        onCheckedChange={(checked) => selection.togglePage(page, checked === true)}
                    />
                    <label htmlFor={selectPageId} className="text-sm text-muted">
                        {t('view.selectPage')}
                    </label>
                </div>
            )}
            {selected.length > 0 && (
                <>
                    <span className="text-sm text-muted">{t('view.selectedCount', { count: selected.length })}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('view.clearSelection')}
                        onClick={selection?.clear}
                    >
                        <X className="size-4" />
                    </Button>
                </>
            )}
            {actions.map((action) => (
                <Button
                    key={action.id}
                    type="button"
                    variant={action.destructive ? 'destructive' : 'outline'}
                    size="sm"
                    disabled={runtime.runningActionId !== undefined}
                    onClick={() => runtime.run(action, selected)}
                >
                    {action.handler === 'export' && <Download className="size-4" />}
                    {action.handler === 'delete' && <Trash2 className="size-4" />}
                    {action.label}
                </Button>
            ))}
        </div>
    );
}

export function ViewRowActions({ hit }: { hit: ViewHit }) {
    const { t } = useUITranslation();
    const runtime = useViewActions();
    const actions = runtime?.actions.filter(
        (action) => (action.placement ?? 'selection') === 'row' && selectionMatches(action, [hit]),
    );
    if (!runtime || !actions?.length) return null;

    return (
        <Popover>
            <PopoverTrigger>
                <Button type="button" variant="ghost" size="icon" aria-label={t('view.actions')}>
                    <EllipsisVertical className="size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end" sideOffset={6}>
                <SelectList
                    options={actions}
                    optionLayout={(action) => ({
                        label: action.label,
                        className: action.destructive ? 'text-destructive' : undefined,
                    })}
                    onChange={(action) => runtime.run(action, [hit])}
                    noCheck
                />
            </PopoverContent>
        </Popover>
    );
}
