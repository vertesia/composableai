/**
 * ArtifactContentRenderer - Renders artifact content by type
 *
 * Supports rendering charts, tables, markdown, fusion fragments, and more.
 */

import { useMemo, type ReactElement } from 'react';
import DOMPurify from 'dompurify';
import { CodeBlockPlaceholder, CodeBlockErrorBoundary } from './CodeBlockPlaceholder';
import { type VegaLiteChartSpec } from '../../features/agent/chat/AgentChart';
import { VegaLiteChart } from '../../features/agent/chat/VegaLiteChart';
import { FusionFragmentHandler, FusionFragmentProvider } from '@vertesia/fusion-ux';
import { MarkdownRenderer } from './MarkdownRenderer';

// Render type mapping
export type ExpandRenderType =
    | 'chart'
    | 'vega-lite'
    | 'table'
    | 'markdown'
    | 'fusion-fragment'
    | 'mockup'
    | 'code'
    | 'image'
    | 'auto';

export interface ArtifactContentRendererProps {
    /** The fetched content (parsed JSON or string) */
    content: unknown;
    /** The explicit render type (from expand:type syntax) */
    renderType: ExpandRenderType;
    /** Artifact path (for display and type detection) */
    path: string;
    /** Run ID for nested artifact references */
    runId?: string;
    /** Content type detected from path */
    contentType?: 'json' | 'text' | 'binary';
}

/**
 * Auto-detect render type from content and path
 */
function autoDetectRenderType(
    content: unknown,
    path: string,
    contentType?: 'json' | 'text' | 'binary'
): ExpandRenderType {
    const ext = path.split('.').pop()?.toLowerCase();

    // SVG files → mockup renderer (inline SVG from text content)
    if (ext === 'svg') {
        return 'mockup';
    }

    // Image extensions (binary → rendered via URL)
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) {
        return 'image';
    }

    // Markdown
    if (ext === 'md') {
        return 'markdown';
    }

    // CSV as table
    if (ext === 'csv') {
        return 'table';
    }

    // JSON content - try to detect chart or table
    if (contentType === 'json' && typeof content === 'object' && content !== null) {
        const obj = content as Record<string, unknown>;

        // Check for Vega-Lite schema
        if (typeof obj.$schema === 'string' && obj.$schema.includes('vega')) {
            return 'vega-lite';
        }

        // Check for wrapped Vega-Lite
        if (obj.library === 'vega-lite' && 'spec' in obj) {
            return 'vega-lite';
        }

        // Check for fusion fragment template with data
        if ('template' in obj && 'data' in obj) {
            return 'fusion-fragment';
        }

        // Check for table data (array of objects)
        if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object') {
            return 'table';
        }
    }

    // Default to code
    return 'code';
}

function toVegaLiteSpec(content: unknown): VegaLiteChartSpec | null {
    if (typeof content !== 'object' || content === null) {
        return null;
    }

    const obj = content as Record<string, unknown>;

    if (obj.library === 'vega-lite' && 'spec' in obj && typeof obj.spec === 'object' && obj.spec !== null) {
        return obj as unknown as VegaLiteChartSpec;
    }

    if (typeof obj.$schema === 'string' && obj.$schema.includes('vega')) {
        return { library: 'vega-lite', spec: obj };
    }

    return null;
}

/**
 * Table renderer for array data or CSV
 */
function TableRenderer({ content }: { content: unknown }): ReactElement {
    const { headers, rows } = useMemo(() => {
        if (!Array.isArray(content) || content.length === 0) {
            return { headers: [], rows: [] };
        }

        // Extract headers from first object
        const first = content[0];
        if (typeof first !== 'object' || first === null) {
            return { headers: [], rows: [] };
        }

        const headers = Object.keys(first);
        const rows = content.map(row =>
            headers.map(h => {
                const val = (row as Record<string, unknown>)[h];
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val);
            })
        );

        return { headers, rows };
    }, [content]);

    if (headers.length === 0) {
        return (
            <CodeBlockPlaceholder type="table" error="No table data found" />
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b">
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium text-muted">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b border-muted/20">
                            {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > 100 && (
                <div className="text-sm text-muted py-2">
                    Showing 100 of {rows.length} rows
                </div>
            )}
        </div>
    );
}

/**
 * Code block renderer for raw content
 */
function CodeRenderer({ content, path }: { content: unknown; path: string }): ReactElement {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const code = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    return (
        <pre className="overflow-x-auto p-3 bg-muted/10 rounded text-sm">
            <code className={`language-${ext}`}>{code}</code>
        </pre>
    );
}

/**
 * Sanitize SVG markup using DOMPurify.
 * Allows only safe SVG elements; strips scripts, event handlers, and foreignObject.
 */
export function sanitizeSvg(svg: string): string {
    return DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['use'],
        FORBID_TAGS: ['foreignObject'],
    });
}

/**
 * Make SVG responsive — remove fixed dimensions, ensure viewBox.
 */
export function makeSvgResponsive(svg: string): string {
    return svg.replace(/<svg([^>]*)>/i, (_full: string, attrs: string) => {
        let a = attrs;
        if (!/viewBox/i.test(a)) {
            const w = /\swidth\s*=\s*["']?(\d+(?:\.\d+)?)/i.exec(a);
            const h = /\sheight\s*=\s*["']?(\d+(?:\.\d+)?)/i.exec(a);
            if (w && h) a += ` viewBox="0 0 ${w[1]} ${h[1]}"`;
        }
        a = a
            .replace(/\swidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
            .replace(/\sheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
        if (/style="/i.test(a)) {
            a = a.replace(/style="([^"]*)"/i, (_: string, v: string) =>
                `style="${v};width:100%;height:auto;display:block;max-width:100%;"`);
        } else {
            a += ' style="width:100%;height:auto;display:block;max-width:100%;"';
        }
        if (!/preserveAspectRatio=/i.test(a)) {
            a += ' preserveAspectRatio="xMidYMid meet"';
        }
        return `<svg${a}>`;
    });
}

/**
 * Mockup renderer — renders raw SVG content inline after sanitization.
 */
function MockupRenderer({ content }: { content: unknown }): ReactElement {
    const processedSvg = useMemo(() => {
        const raw = typeof content === 'string' ? content.trim() : '';
        if (!raw) return null;
        return makeSvgResponsive(sanitizeSvg(raw));
    }, [content]);

    if (!processedSvg) {
        return <CodeBlockPlaceholder type="expand" error="Empty mockup" />;
    }

    return (
        <div
            style={{ margin: '16px 0', width: '100%', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: processedSvg }}
        />
    );
}

/**
 * Image renderer
 */
function ImageRenderer({ content, path }: { content: unknown; path: string }): ReactElement {
    const url = typeof content === 'string' ? content : '';
    const alt = path.split('/').pop() || 'Artifact image';

    return (
        <img
            src={url}
            alt={alt}
            className="max-w-full h-auto rounded"
            loading="lazy"
        />
    );
}

/**
 * ArtifactContentRenderer - Main component
 *
 * Renders artifact content based on explicit type or auto-detection.
 */
export function ArtifactContentRenderer({
    content,
    renderType,
    path,
    runId,
    contentType,
}: ArtifactContentRendererProps): ReactElement {
    // Determine actual render type
    const actualType = useMemo(() => {
        if (renderType !== 'auto') {
            return renderType;
        }
        return autoDetectRenderType(content, path, contentType);
    }, [content, path, contentType, renderType]);

    // Render based on type
    switch (actualType) {
        case 'chart': {
            const spec = toVegaLiteSpec(content);
            if (!spec) {
                return (
                    <CodeBlockPlaceholder
                        type="chart"
                        error="Only Vega-Lite charts are supported. Recharts rendering has been retired."
                    />
                );
            }
            return (
                <CodeBlockErrorBoundary type="chart" fallbackCode={JSON.stringify(content, null, 2)}>
                    <VegaLiteChart spec={spec} artifactRunId={runId} />
                </CodeBlockErrorBoundary>
            );
        }

        case 'vega-lite': {
            const spec = toVegaLiteSpec(content);
            if (!spec) {
                return (
                    <CodeBlockPlaceholder
                        type="chart"
                        error="Invalid Vega-Lite specification"
                    />
                );
            }
            return (
                <CodeBlockErrorBoundary type="chart" fallbackCode={JSON.stringify(content, null, 2)}>
                    <VegaLiteChart spec={spec} artifactRunId={runId} />
                </CodeBlockErrorBoundary>
            );
        }

        case 'fusion-fragment': {
            // For fusion fragments, content should have { template, data }
            // Wrap with FusionFragmentProvider to inject VegaLiteChart for embedded charts
            const fragmentContent = content as { template?: unknown; data?: Record<string, unknown> };
            console.log('[ArtifactContentRenderer] fusion-fragment:', {
                hasTemplate: !!fragmentContent.template,
                hasData: !!fragmentContent.data,
                runId,
                hasVegaLiteChart: !!VegaLiteChart,
            });
            if (fragmentContent.template && fragmentContent.data) {
                return (
                    <CodeBlockErrorBoundary type="fusion-fragment" fallbackCode={JSON.stringify(content, null, 2)}>
                        <FusionFragmentProvider
                            data={fragmentContent.data}
                            ChartComponent={VegaLiteChart}
                            artifactRunId={runId}
                        >
                            <FusionFragmentHandler
                                code={JSON.stringify(fragmentContent.template)}
                                data={fragmentContent.data}
                            />
                        </FusionFragmentProvider>
                    </CodeBlockErrorBoundary>
                );
            }
            // If no data wrapper, treat as template-only (needs context from parent provider)
            return (
                <CodeBlockErrorBoundary type="fusion-fragment" fallbackCode={JSON.stringify(content, null, 2)}>
                    <FusionFragmentHandler code={JSON.stringify(content)} />
                </CodeBlockErrorBoundary>
            );
        }

        case 'table':
            return (
                <CodeBlockErrorBoundary type="table" fallbackCode={JSON.stringify(content, null, 2)}>
                    <TableRenderer content={content} />
                </CodeBlockErrorBoundary>
            );

        case 'markdown': {
            const markdownContent = typeof content === 'string' ? content : String(content);
            return (
                <CodeBlockErrorBoundary type="markdown" fallbackCode={markdownContent}>
                    <MarkdownRenderer artifactRunId={runId}>
                        {markdownContent}
                    </MarkdownRenderer>
                </CodeBlockErrorBoundary>
            );
        }

        case 'mockup':
            return (
                <CodeBlockErrorBoundary type="expand" fallbackCode={typeof content === 'string' ? content : path}>
                    <MockupRenderer content={content} />
                </CodeBlockErrorBoundary>
            );

        case 'image':
            return (
                <CodeBlockErrorBoundary type="image" fallbackCode={path}>
                    <ImageRenderer content={content} path={path} />
                </CodeBlockErrorBoundary>
            );

        case 'code':
        default:
            return <CodeRenderer content={content} path={path} />;
    }
}
