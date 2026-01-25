import React, { useMemo } from 'react';
import type { CodeBlockRendererProps } from './CodeBlockRendering';
import { CodeBlockPlaceholder, CodeBlockErrorBoundary } from './CodeBlockPlaceholder';
import { AgentChart, type AgentChartSpec } from '../../features/agent/chat/AgentChart';
import { VegaLiteChart } from '../../features/agent/chat/VegaLiteChart';
import { MermaidDiagram } from './MermaidDiagram';
import { AskUserWidget, type AskUserWidgetProps } from '../../features/agent/chat/AskUserWidget';
import { useArtifactContent } from './useArtifactContent';
import { ArtifactContentRenderer, type ExpandRenderType } from './ArtifactContentRenderer';

/**
 * Context for passing artifact run ID and callbacks to code block handlers
 */
export interface CodeBlockHandlerContext {
    artifactRunId?: string;
    onProposalSelect?: (optionId: string) => void;
    onProposalSubmit?: (response: string) => void;
}

const CodeBlockContext = React.createContext<CodeBlockHandlerContext>({});

export function CodeBlockHandlerProvider({
    children,
    artifactRunId,
    onProposalSelect,
    onProposalSubmit,
}: CodeBlockHandlerContext & { children: React.ReactNode }) {
    const value = useMemo(
        () => ({ artifactRunId, onProposalSelect, onProposalSubmit }),
        [artifactRunId, onProposalSelect, onProposalSubmit]
    );
    return <CodeBlockContext.Provider value={value}>{children}</CodeBlockContext.Provider>;
}

export function useCodeBlockContext() {
    return React.useContext(CodeBlockContext);
}

/**
 * Parses chart JSON from code block content.
 * Handles cases where extra content is appended after the JSON.
 */
function parseChartJson(code: string): Record<string, unknown> | null {
    try {
        let raw = code.trim();
        const jsonStart = raw.indexOf('{');
        const jsonEnd = raw.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            raw = raw.slice(jsonStart, jsonEnd + 1);
        }
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Detects the chart library from a parsed spec
 */
function detectChartLibrary(
    spec: Record<string, unknown>
): 'vega-lite' | 'recharts' | null {
    // Detect Vega-Lite by $schema containing "vega"
    const hasVegaSchema =
        typeof spec.$schema === 'string' && spec.$schema.includes('vega');
    const isExplicitVegaLite = spec.library === 'vega-lite' && 'spec' in spec;

    if (hasVegaSchema || isExplicitVegaLite) {
        return 'vega-lite';
    }

    // Recharts: check for 'chart' property OR library === 'recharts' with data
    const isRecharts =
        ('chart' in spec || 'type' in spec || spec.library === 'recharts') &&
        'data' in spec &&
        Array.isArray(spec.data);

    if (isRecharts) {
        return 'recharts';
    }

    return null;
}

/**
 * Vega-Lite code block handler
 * Always renders with VegaLiteChart directly - no routing through AgentChart
 */
export function VegaLiteCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();

    const chartSpec = useMemo(() => {
        const spec = parseChartJson(code);
        if (!spec) return null;

        // Wrap as VegaLiteChartSpec format
        return { library: 'vega-lite' as const, spec };
    }, [code]);

    if (!chartSpec) {
        return (
            <CodeBlockPlaceholder
                type="chart"
                error="Invalid Vega-Lite specification"
            />
        );
    }

    // Render VegaLiteChart directly - bypass AgentChart routing
    return (
        <CodeBlockErrorBoundary type="chart" fallbackCode={code}>
            <VegaLiteChart spec={chartSpec} artifactRunId={artifactRunId} />
        </CodeBlockErrorBoundary>
    );
}

/**
 * Chart code block handler
 * Supports both Vega-Lite and Recharts specifications
 * Routes directly to the appropriate chart component based on detected library
 */
export function ChartCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();

    const { chartSpec, isVegaLite } = useMemo(() => {
        const spec = parseChartJson(code);
        if (!spec) return { chartSpec: null, isVegaLite: false };

        const library = detectChartLibrary(spec);
        if (!library) return { chartSpec: null, isVegaLite: false };

        // Vega-Lite spec - wrap in expected format
        if (library === 'vega-lite') {
            // If already wrapped (has library: 'vega-lite' and spec property), use as-is
            if (spec.library === 'vega-lite' && 'spec' in spec) {
                return { chartSpec: spec, isVegaLite: true };
            }
            // Native Vega-Lite spec - wrap it
            return { chartSpec: { library: 'vega-lite' as const, spec }, isVegaLite: true };
        }

        // Recharts spec
        return { chartSpec: spec, isVegaLite: false };
    }, [code]);

    if (!chartSpec) {
        return (
            <CodeBlockPlaceholder
                type="chart"
                error="Invalid chart specification"
            />
        );
    }

    // Route directly to the appropriate chart component
    if (isVegaLite) {
        return (
            <CodeBlockErrorBoundary type="chart" fallbackCode={code}>
                <VegaLiteChart spec={chartSpec as any} artifactRunId={artifactRunId} />
            </CodeBlockErrorBoundary>
        );
    }

    return (
        <CodeBlockErrorBoundary type="chart" fallbackCode={code}>
            <AgentChart spec={chartSpec as AgentChartSpec} artifactRunId={artifactRunId} />
        </CodeBlockErrorBoundary>
    );
}

/**
 * Mermaid diagram code block handler
 */
export function MermaidCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
        return (
            <CodeBlockPlaceholder
                type="mermaid"
                error="Empty diagram"
            />
        );
    }

    return (
        <CodeBlockErrorBoundary type="mermaid" fallbackCode={code}>
            <MermaidDiagram code={trimmedCode} />
        </CodeBlockErrorBoundary>
    );
}

/**
 * Proposal/AskUser code block handler
 */
export function ProposalCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { onProposalSelect, onProposalSubmit } = useCodeBlockContext();

    const widgetProps = useMemo((): AskUserWidgetProps | null => {
        try {
            const raw = code.trim();
            const spec = JSON.parse(raw);

            if (!spec.options || (!spec.question && !spec.title)) {
                return null;
            }

            const props: AskUserWidgetProps = {
                question: spec.question || spec.title || '',
                description: spec.description,
                options: Array.isArray(spec.options)
                    ? spec.options.map((opt: any) => ({
                          id: opt.id || opt.value || '',
                          label: opt.label || '',
                          description: opt.description,
                      }))
                    : undefined,
                allowFreeResponse: spec.allowFreeResponse ?? spec.multiple,
                variant: spec.variant,
                onSelect: onProposalSelect,
                onSubmit: onProposalSubmit,
            };

            if (!props.question || !props.options?.length) {
                return null;
            }

            return props;
        } catch {
            return null;
        }
    }, [code, onProposalSelect, onProposalSubmit]);

    if (!widgetProps) {
        return (
            <CodeBlockPlaceholder
                type="proposal"
                error="Invalid proposal specification"
            />
        );
    }

    return (
        <CodeBlockErrorBoundary type="proposal" fallbackCode={code}>
            <AskUserWidget {...widgetProps} />
        </CodeBlockErrorBoundary>
    );
}

/**
 * Expand code block handler - fetches artifact and renders content inline.
 *
 * Usage: ```expand:chart, ```expand:table, ```expand:markdown, ```expand:fusion-fragment, etc.
 * The type after colon specifies the renderer.
 *
 * @example
 * ```expand:chart
 * direct/chart_abc123.json
 * ```
 */
export function ExpandCodeBlockHandler({ code, language }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();
    const artifactPath = code.trim();

    // Extract render type from language (e.g., "expand:chart" → "chart")
    const renderType: ExpandRenderType = useMemo(() => {
        if (!language?.includes(':')) {
            return 'auto';
        }
        const type = language.split(':')[1] as ExpandRenderType;
        // Validate known types
        const validTypes: ExpandRenderType[] = [
            'chart', 'vega-lite', 'table', 'markdown',
            'fusion-fragment', 'code', 'image', 'auto'
        ];
        return validTypes.includes(type) ? type : 'auto';
    }, [language]);

    // Fetch artifact content from GCS
    const { data, isLoading, error, contentType } = useArtifactContent({
        runId: artifactRunId,
        path: artifactPath,
    });

    if (!artifactRunId) {
        return (
            <CodeBlockPlaceholder
                type="expand"
                error="No artifact run ID available"
            />
        );
    }

    if (isLoading) {
        return (
            <CodeBlockPlaceholder
                type="expand"
                message={`Loading ${artifactPath}...`}
            />
        );
    }

    if (error) {
        return (
            <CodeBlockPlaceholder
                type="expand"
                error={`Failed to load artifact: ${error}`}
            />
        );
    }

    if (data === undefined) {
        return (
            <CodeBlockPlaceholder
                type="expand"
                error="No content found in artifact"
            />
        );
    }

    // Render with explicit type
    return (
        <ArtifactContentRenderer
            content={data}
            renderType={renderType}
            path={artifactPath}
            runId={artifactRunId}
            contentType={contentType}
        />
    );
}

/**
 * Check if a language string is an expand:* pattern
 */
export function isExpandLanguage(language: string | undefined): boolean {
    return language?.startsWith('expand') ?? false;
}

/**
 * Creates the default code block handlers map.
 *
 * These handlers are used as fallbacks when no custom handler is registered
 * via CodeBlockRendererRegistry for a given language. The priority order in
 * MarkdownRenderer is:
 *
 * 1. User-registered handlers (via CodeBlockRendererRegistry)
 * 2. Default handlers (from this function)
 * 3. Existing code component (if passed via components prop)
 * 4. Default <code> element rendering
 *
 * This allows users to override default behavior for specific languages
 * while still getting built-in support for charts, diagrams, and proposals.
 */
export function createDefaultCodeBlockHandlers(): Record<
    string,
    React.FunctionComponent<CodeBlockRendererProps>
> {
    return {
        // Chart handler for generic chart code blocks (auto-detects library)
        chart: ChartCodeBlockHandler,
        // Vega-Lite handlers - always treat as Vega-Lite
        'vega-lite': VegaLiteCodeBlockHandler,
        'vegalite': VegaLiteCodeBlockHandler,

        // Mermaid handler
        mermaid: MermaidCodeBlockHandler,

        // Proposal handlers
        proposal: ProposalCodeBlockHandler,
        askuser: ProposalCodeBlockHandler,
    };
}
