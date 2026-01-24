import React, { useMemo } from 'react';
import type { CodeBlockRendererProps } from './CodeBlockRendering';
import { CodeBlockPlaceholder, CodeBlockErrorBoundary } from './CodeBlockPlaceholder';
import { AgentChart, type AgentChartSpec } from '../../features/agent/chat/AgentChart';
import { MermaidDiagram } from './MermaidDiagram';
import { AskUserWidget, type AskUserWidgetProps } from '../../features/agent/chat/AskUserWidget';

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
 * Always treats content as native Vega-Lite specification
 */
export function VegaLiteCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();

    const chartSpec = useMemo(() => {
        const spec = parseChartJson(code);
        if (!spec) return null;

        // Always wrap as Vega-Lite since this handler is for vega-lite code blocks
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

    return (
        <CodeBlockErrorBoundary type="chart" fallbackCode={code}>
            <AgentChart spec={chartSpec as AgentChartSpec} artifactRunId={artifactRunId} />
        </CodeBlockErrorBoundary>
    );
}

/**
 * Chart code block handler
 * Supports both Vega-Lite and Recharts specifications
 */
export function ChartCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();

    const chartSpec = useMemo(() => {
        const spec = parseChartJson(code);
        if (!spec) return null;

        const library = detectChartLibrary(spec);
        if (!library) return null;

        // Wrap native Vega-Lite spec (with $schema) in expected format
        if (
            library === 'vega-lite' &&
            typeof spec.$schema === 'string' &&
            spec.library !== 'vega-lite'
        ) {
            return { library: 'vega-lite' as const, spec };
        }

        return spec;
    }, [code]);

    if (!chartSpec) {
        return (
            <CodeBlockPlaceholder
                type="chart"
                error="Invalid chart specification"
            />
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
