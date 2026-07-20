import type {
    ExecuteViewRequest,
    ViewDisplayConfiguration,
    ViewExecutionResult,
    ViewHit,
    ViewNavigationItem,
    ViewResultMedia,
} from '@vertesia/common';
import { ImageRenditionFormat } from '@vertesia/common';
import { Button, ErrorBox, MessageBox, SelectBox, Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { FullHeightLayout } from '@vertesia/ui/layout';
import { useUserSession } from '@vertesia/ui/session';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenericPageNavHeader } from '../layout/GenericPageNavHeader.js';
import type { ViewExecutor, ViewExperienceRenderers, ViewMediaResolver } from './types.js';
import { DefaultViewNavigation } from './ViewNavigation.js';
import { DefaultViewResults } from './ViewResults.js';
import { DefaultViewSearch } from './ViewSearch.js';
import { canonicalizeViewState, parseViewState, replaceViewStateInUrl, resolveViewSort } from './viewState.js';

const FALLBACK_DISPLAY: ViewDisplayConfiguration = {
    id: 'default',
    label: 'Results',
    type: 'list',
    title: { field: 'name' },
    subtitle: [
        { field: 'type.name', format: 'content_type' },
        { field: 'location', format: 'location' },
    ],
    description: { field: 'description' },
};

export interface ViewExperienceProps {
    viewId: string;
    /** Override execution for embedded apps or tests. Defaults to client.store.views.execute. */
    execute?: ViewExecutor;
    renderers?: ViewExperienceRenderers;
    onOpenHit?: (hit: ViewHit) => void;
    /** Override media resolution for embedded apps or custom storage backends. */
    resolveMedia?: ViewMediaResolver;
    syncUrl?: boolean;
    showHeader?: boolean;
    className?: string;
}

function initialRequest(syncUrl: boolean): ExecuteViewRequest {
    if (!syncUrl || typeof window === 'undefined') return {};
    return parseViewState(window.location.search);
}

function cleanRecord(values: Record<string, string[]>): Record<string, string[]> | undefined {
    const filtered = Object.fromEntries(Object.entries(values).filter(([, entries]) => entries.length > 0));
    return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function ViewExperienceWithSession(props: Omit<ViewExperienceProps, 'execute'>) {
    const { client } = useUserSession();
    const execute = useCallback(
        (request: ExecuteViewRequest) => client.store.views.execute(props.viewId, request),
        [client, props.viewId],
    );
    const resolveMedia = useCallback<ViewMediaResolver>(
        async (hit: ViewHit, media: ViewResultMedia) => {
            if (media.source !== 'content_thumbnail') return undefined;

            const content = hit.document.content;
            try {
                const rendition = await client.objects.getRenditionSafe(hit.id, content?.type, {
                    format: ImageRenditionFormat.jpeg,
                    max_hw: 512,
                    generate_if_missing: false,
                    sign_url: true,
                });
                if (rendition?.status === 'found' && rendition.renditions?.length) {
                    return rendition.renditions[0];
                }
            } catch {
                // A missing optional rendition falls through to the original image.
            }

            if (content?.source && content.type?.startsWith('image/')) {
                const download = await client.files.getDownloadUrl(content.source);
                return download.url;
            }
            return undefined;
        },
        [client],
    );
    return <ViewExperienceRuntime {...props} execute={execute} resolveMedia={props.resolveMedia ?? resolveMedia} />;
}

/**
 * Reusable renderer for stored and app-contributed View Experiences.
 * Pass `execute` to use it outside Vertesia's session provider.
 */
export function ViewExperience({ execute, ...props }: ViewExperienceProps) {
    return execute ? (
        <ViewExperienceRuntime key={props.viewId} {...props} execute={execute} />
    ) : (
        <ViewExperienceWithSession key={props.viewId} {...props} />
    );
}

interface ViewExperienceRuntimeProps extends Omit<ViewExperienceProps, 'execute'> {
    execute: ViewExecutor;
}

function ViewExperienceRuntime({
    execute,
    renderers,
    onOpenHit,
    resolveMedia,
    syncUrl = true,
    showHeader = true,
    className,
}: ViewExperienceRuntimeProps) {
    const { t } = useUITranslation();
    const executeRef = useRef(execute);
    executeRef.current = execute;
    const generationRef = useRef(0);
    const [request, setRequest] = useState<ExecuteViewRequest>(() => initialRequest(syncUrl));
    const [draftQuery, setDraftQuery] = useState(request.query ?? '');
    const [draftKeyTerms, setDraftKeyTerms] = useState<Record<string, string[]>>(request.key_terms ?? {});
    const [result, setResult] = useState<ViewExecutionResult>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error>();

    const runRequest = useCallback(
        (next: ExecuteViewRequest, updateUrl: boolean) => {
            const generation = ++generationRef.current;
            setRequest(next);
            if (updateUrl && syncUrl) replaceViewStateInUrl(next);
            setIsLoading(true);
            setError(undefined);
            return executeRef
                .current(next)
                .then((response) => {
                    if (generation === generationRef.current) {
                        const canonicalRequest = canonicalizeViewState(next, response);
                        setRequest(canonicalRequest);
                        if (syncUrl) replaceViewStateInUrl(canonicalRequest);
                        setResult(response);
                    }
                })
                .catch((cause: unknown) => {
                    if (generation === generationRef.current) {
                        setError(cause instanceof Error ? cause : new Error(String(cause)));
                    }
                })
                .finally(() => {
                    if (generation === generationRef.current) setIsLoading(false);
                });
        },
        [syncUrl],
    );

    const loadUrlState = useCallback(() => {
        const next = initialRequest(syncUrl);
        setDraftQuery(next.query ?? '');
        setDraftKeyTerms(next.key_terms ?? {});
        return runRequest(next, false);
    }, [runRequest, syncUrl]);

    useEffect(() => {
        void loadUrlState();
        return () => {
            generationRef.current += 1;
        };
    }, [loadUrlState]);

    useEffect(() => {
        if (!syncUrl || typeof window === 'undefined') return;
        const onPopState = () => void loadUrlState();
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [loadUrlState, syncUrl]);

    const definition = result?.definition;
    const navigation = useMemo(
        () => [...(definition?.navigation ?? [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
        [definition?.navigation],
    );
    const resultsConfiguration = definition?.results;
    const effectiveDisplayId = result?.display ?? request.display ?? resultsConfiguration?.default_display;
    const display =
        resultsConfiguration?.displays.find((candidate) => candidate.id === effectiveDisplayId) ?? FALLBACK_DISPLAY;
    const effectiveSortId = result
        ? resolveViewSort(request, result, resultsConfiguration?.default_sort)
        : request.sort;

    const applyRequest = (next: ExecuteViewRequest) => {
        void runRequest(next, true);
    };

    const updateNavigation = (item: ViewNavigationItem, values: string[]) => {
        const nextNavigation = cleanRecord({ ...(request.navigation ?? {}), [item.id]: values });
        applyRequest({ ...request, navigation: nextNavigation, offset: undefined });
    };

    const submitSearch = () => {
        applyRequest({
            ...request,
            query: draftQuery.trim() || undefined,
            key_terms: cleanRecord(draftKeyTerms),
            offset: undefined,
        });
    };

    if (!result && isLoading) {
        return (
            <div className="flex h-full min-h-48 items-center justify-center">
                <Spinner size="xl" />
            </div>
        );
    }

    if (!result || !definition) {
        return (
            <div className="flex h-full min-h-48 items-center justify-center p-4">
                <ErrorBox
                    title={t('store.searchFailed')}
                    action={() => void loadUrlState()}
                    actionLabel={t('agent.retry')}
                >
                    {t('store.searchFailed')}
                </ErrorBox>
            </div>
        );
    }

    const SearchRenderer = definition.search?.renderer
        ? (renderers?.search?.[definition.search.renderer] ?? DefaultViewSearch)
        : DefaultViewSearch;
    const ResultsRenderer = display.renderer
        ? (renderers?.results?.[display.renderer] ?? DefaultViewResults)
        : DefaultViewResults;
    const hasSidebarNavigation = navigation.length > 0 && definition.layout?.navigation_position !== 'top';
    const isWorklist = definition.layout?.mode === 'worklist';
    const offset = request.offset ?? 0;
    const pageStep = request.limit ?? display.page_size ?? 20;
    const hasPrevious = offset > 0;
    const hasNext = offset + result.hits.length < result.total;

    const navigationWidgets = navigation.map((item) => {
        const navigationResult = result.navigation[item.id] ?? { id: item.id, selected: [], nodes: [] };
        const NavigationRenderer = item.renderer
            ? (renderers?.navigation?.[item.renderer] ?? DefaultViewNavigation)
            : DefaultViewNavigation;
        return (
            <NavigationRenderer
                key={item.id}
                configuration={item}
                result={navigationResult}
                isLoading={isLoading}
                onChange={(values) => updateNavigation(item, values)}
            />
        );
    });

    return (
        <FullHeightLayout className={className}>
            {showHeader && <GenericPageNavHeader title={definition.name} description={definition.description} />}
            <FullHeightLayout.Fixed heightClass="h-auto" className="space-y-3 border-b p-3">
                {definition.search && (
                    <SearchRenderer
                        configuration={definition.search}
                        query={draftQuery}
                        keyTerms={draftKeyTerms}
                        isLoading={isLoading}
                        onQueryChange={setDraftQuery}
                        onKeyTermsChange={(id, values) => setDraftKeyTerms((current) => ({ ...current, [id]: values }))}
                        onSubmit={submitSearch}
                    />
                )}
                {navigation.length > 0 && definition.layout?.navigation_position === 'top' && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{navigationWidgets}</div>
                )}
            </FullHeightLayout.Fixed>
            <FullHeightLayout.Body className="p-0">
                <div
                    className={
                        hasSidebarNavigation
                            ? isWorklist
                                ? 'grid min-h-full lg:grid-cols-[minmax(0,1fr)_18rem]'
                                : 'grid min-h-full lg:grid-cols-[18rem_minmax(0,1fr)]'
                            : 'min-h-full'
                    }
                >
                    {hasSidebarNavigation && (
                        <aside
                            className={
                                isWorklist
                                    ? 'space-y-5 border-b p-4 lg:order-2 lg:border-s lg:border-b-0'
                                    : 'space-y-5 border-b p-4 lg:border-e lg:border-b-0'
                            }
                        >
                            {navigationWidgets}
                        </aside>
                    )}
                    <main className={`min-w-0 space-y-4 p-4 ${isWorklist ? 'lg:order-1' : ''}`}>
                        {error && (
                            <ErrorBox
                                title={t('store.searchFailed')}
                                action={() => void runRequest(request, false)}
                                actionLabel={t('agent.retry')}
                            >
                                {t('store.searchFailed')}
                            </ErrorBox>
                        )}
                        {result.search.warnings.length > 0 && (
                            <MessageBox status="warning" title={t('view.warning')}>
                                <ul className="list-disc space-y-1 ps-4">
                                    {result.search.warnings.map((warning) => (
                                        <li key={`${warning.code}-${warning.path ?? ''}`}>{warning.message}</li>
                                    ))}
                                </ul>
                            </MessageBox>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm text-muted">
                                <span>{t('view.resultsCount', { count: result.total })}</span>
                                {isLoading && <Spinner size="sm" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {resultsConfiguration?.allow_display_switch &&
                                    resultsConfiguration.displays.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted">{t('view.display')}</span>
                                            <SelectBox
                                                options={resultsConfiguration.displays}
                                                value={display}
                                                onChange={(option) =>
                                                    applyRequest({ ...request, display: option.id, offset: undefined })
                                                }
                                                optionLabel={(option) => option.label}
                                                by="id"
                                                disabled={isLoading}
                                                aria-label={t('view.display')}
                                                className="min-w-36"
                                            />
                                        </div>
                                    )}
                                {resultsConfiguration?.sort_options && resultsConfiguration.sort_options.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted">{t('view.sort')}</span>
                                        <SelectBox
                                            options={resultsConfiguration.sort_options}
                                            value={resultsConfiguration.sort_options.find(
                                                (option) => option.id === effectiveSortId,
                                            )}
                                            onChange={(option) =>
                                                applyRequest({ ...request, sort: option.id, offset: undefined })
                                            }
                                            optionLabel={(option) => option.label}
                                            by="id"
                                            disabled={isLoading}
                                            aria-label={t('view.sort')}
                                            className="min-w-44"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <ResultsRenderer
                            configuration={display}
                            definition={definition}
                            request={request}
                            result={result}
                            isLoading={isLoading}
                            onSortChange={(sort) => applyRequest({ ...request, sort, offset: undefined })}
                            onOpenHit={onOpenHit}
                            resolveMedia={resolveMedia}
                        />
                        {(hasPrevious || hasNext) && (
                            <nav className="flex items-center justify-center gap-2" aria-label={t('view.pagination')}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!hasPrevious || isLoading}
                                    onClick={() =>
                                        applyRequest({
                                            ...request,
                                            offset: Math.max(0, offset - pageStep) || undefined,
                                        })
                                    }
                                >
                                    <ChevronLeft className="size-4 cn-rtl-flip" />
                                    {t('grounded.previousPage')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!hasNext || isLoading}
                                    onClick={() => applyRequest({ ...request, offset: offset + pageStep })}
                                >
                                    {t('grounded.nextPage')}
                                    <ChevronRight className="size-4 cn-rtl-flip" />
                                </Button>
                            </nav>
                        )}
                    </main>
                </div>
            </FullHeightLayout.Body>
        </FullHeightLayout>
    );
}
