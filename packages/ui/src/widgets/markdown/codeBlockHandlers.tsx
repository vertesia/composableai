import React, { useMemo } from 'react';
import type { CodeBlockRendererProps } from './CodeBlockRendering';
import { CodeBlockPlaceholder, CodeBlockErrorBoundary } from './CodeBlockPlaceholder';
import type { VegaLiteChartSpec } from '../../features/agent/chat/AgentChart';
import { VegaLiteChart } from '../../features/agent/chat/VegaLiteChart';
import { MermaidDiagram } from './MermaidDiagram';
import { AskUserWidget, type AskUserWidgetProps } from '../../features/agent/chat/AskUserWidget';
import { useArtifactContent } from './useArtifactContent';
import { ArtifactContentRenderer, type ExpandRenderType, sanitizeSvg, makeSvgResponsive } from './ArtifactContentRenderer';

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
 * Check if JSON parsing failed due to incomplete content (streaming)
 * vs actually invalid JSON structure
 */
function isIncompleteJson(code: string): boolean {
    const trimmed = code.trim();

    // Empty or very short content is likely incomplete
    if (trimmed.length < 2) return true;

    // Must start with { for a valid JSON object
    if (!trimmed.startsWith('{')) return false;

    // Try to parse - if it succeeds, it's not incomplete
    try {
        JSON.parse(trimmed);
        return false; // Valid JSON
    } catch (e) {
        const message = e instanceof Error ? e.message : '';

        // Common indicators of incomplete JSON during streaming
        const incompleteIndicators = [
            'unexpected end',
            'unterminated string',
            'expected',
            'unexpected token',
        ];

        const lowerMessage = message.toLowerCase();
        if (incompleteIndicators.some(ind => lowerMessage.includes(ind))) {
            // Additional check: count brackets to see if they're unbalanced
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escaped = false;

            for (const char of trimmed) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (char === '\\') {
                    escaped = true;
                    continue;
                }
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                if (!inString) {
                    if (char === '{') braceCount++;
                    else if (char === '}') braceCount--;
                    else if (char === '[') bracketCount++;
                    else if (char === ']') bracketCount--;
                }
            }

            // If brackets are unbalanced or we're in an unclosed string, it's incomplete
            return braceCount > 0 || bracketCount > 0 || inString;
        }

        // For other parse errors, consider it invalid rather than incomplete
        return false;
    }
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
): 'vega-lite' | null {
    // Detect Vega-Lite by $schema containing "vega"
    const hasVegaSchema =
        typeof spec.$schema === 'string' && spec.$schema.includes('vega');
    const isExplicitVegaLite = spec.library === 'vega-lite' && 'spec' in spec;

    if (hasVegaSchema || isExplicitVegaLite) {
        return 'vega-lite';
    }

    return null;
}

/**
 * Vega-Lite code block handler
 * Always renders with VegaLiteChart directly - no routing through AgentChart
 */
export function VegaLiteCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();

    // Check if JSON is incomplete (streaming in progress)
    const incomplete = useMemo(() => isIncompleteJson(code), [code]);

    const chartSpec = useMemo(() => {
        if (incomplete) return null;
        const spec = parseChartJson(code);
        if (!spec) return null;

        // Wrap as VegaLiteChartSpec format
        return { library: 'vega-lite' as const, spec };
    }, [code, incomplete]);

    // Show loading placeholder for incomplete JSON (streaming)
    if (incomplete) {
        return (
            <CodeBlockPlaceholder
                type="chart"
                message="Loading chart..."
            />
        );
    }

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
 * `chart` now accepts Vega-Lite specifications only.
 */
export function ChartCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();

    // Check if JSON is incomplete (streaming in progress)
    const incomplete = useMemo(() => isIncompleteJson(code), [code]);

    const chartSpec = useMemo((): VegaLiteChartSpec | null => {
        if (incomplete) return null;

        const spec = parseChartJson(code);
        if (!spec) return null;

        const library = detectChartLibrary(spec);
        if (!library) return null;

        // If already wrapped, use as-is.
        if (spec.library === 'vega-lite' && 'spec' in spec && typeof spec.spec === 'object') {
            return spec as unknown as VegaLiteChartSpec;
        }

        // Native Vega-Lite spec - wrap it.
        return { library: 'vega-lite' as const, spec };
    }, [code, incomplete]);

    // Show loading placeholder for incomplete JSON (streaming)
    if (incomplete) {
        return (
            <CodeBlockPlaceholder
                type="chart"
                message="Loading chart..."
            />
        );
    }

    if (!chartSpec) {
        return (
            <CodeBlockPlaceholder
                type="chart"
                error="Invalid Vega-Lite chart specification"
            />
        );
    }

    return (
        <CodeBlockErrorBoundary type="chart" fallbackCode={code}>
            <VegaLiteChart spec={chartSpec} artifactRunId={artifactRunId} />
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

    // Check if JSON is incomplete (streaming in progress)
    const incomplete = useMemo(() => isIncompleteJson(code), [code]);

    const widgetProps = useMemo((): AskUserWidgetProps | null => {
        if (incomplete) return null;

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
    }, [code, onProposalSelect, onProposalSubmit, incomplete]);

    // Show loading placeholder for incomplete JSON (streaming)
    if (incomplete) {
        return (
            <CodeBlockPlaceholder
                type="proposal"
                message="Loading options..."
            />
        );
    }

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
 * Mockup code block handler — renders inline SVG after sanitization.
 */
export function MockupCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const processedSvg = useMemo(() => {
        const trimmed = code.trim();
        if (!trimmed) return null;
        return makeSvgResponsive(sanitizeSvg(trimmed));
    }, [code]);

    if (!processedSvg) {
        return (
            <CodeBlockPlaceholder type="code" error="Empty mockup" />
        );
    }

    return (
        <CodeBlockErrorBoundary type="code" fallbackCode={code}>
            <div
                style={{ margin: '16px 0', width: '100%', overflowX: 'auto' }}
                dangerouslySetInnerHTML={{ __html: processedSvg }}
            />
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
            'fusion-fragment', 'mockup', 'code', 'image', 'auto'
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
        // Chart handler for generic chart code blocks (Vega-Lite only)
        chart: ChartCodeBlockHandler,
        // Vega-Lite handlers - always treat as Vega-Lite
        'vega-lite': VegaLiteCodeBlockHandler,
        'vegalite': VegaLiteCodeBlockHandler,

        // Mermaid handler
        mermaid: MermaidCodeBlockHandler,

        // Mockup handler (inline SVG)
        mockup: MockupCodeBlockHandler,
        svg: MockupCodeBlockHandler,

        // Proposal handlers
        proposal: ProposalCodeBlockHandler,
        askuser: ProposalCodeBlockHandler,
    };
}
