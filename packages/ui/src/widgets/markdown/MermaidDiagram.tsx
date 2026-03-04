import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';

const MERMAID_FONT_FAMILY =
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Browser-side Mermaid normalization:
 * - Convert escaped newlines in quoted labels (`\n`, `\\n`) to HTML line breaks.
 *   Mermaid web rendering handles `<br/>` labels more reliably than escaped `\n`.
 */
function normalizeMermaidCodeForBrowser(code: string): string {
    const trimmed = code.trim();
    let normalized = '';
    let inDoubleQuote = false;
    let inSingleQuote = false;

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        const prev = i > 0 ? trimmed[i - 1] : '';

        if (char === '"' && !inSingleQuote && prev !== '\\') {
            inDoubleQuote = !inDoubleQuote;
            normalized += char;
            continue;
        }

        if (char === "'" && !inDoubleQuote && prev !== '\\') {
            inSingleQuote = !inSingleQuote;
            normalized += char;
            continue;
        }

        if ((inDoubleQuote || inSingleQuote) && char === '\\') {
            let j = i;
            while (trimmed[j] === '\\') {
                j++;
            }

            if (trimmed[j] === 'n') {
                normalized += '<br/>';
                i = j;
                continue;
            }
        }

        normalized += char;
    }

    return normalized;
}

/**
 * Force Mermaid SVG output to scale with container width.
 * This keeps text and shapes proportional when the container shrinks/expands.
 */
function makeSvgResponsive(svg: string): string {
    return svg.replace(/<svg([^>]*)>/i, (_full, attrs: string) => {
        let nextAttrs = attrs
            .replace(/\swidth="[^"]*"/i, '')
            .replace(/\sheight="[^"]*"/i, '');

        if (/style="/i.test(nextAttrs)) {
            nextAttrs = nextAttrs.replace(
                /style="([^"]*)"/i,
                (_styleFull, styleValue: string) =>
                    `style="${styleValue};width:100%;height:auto;display:block;max-width:100%;"`
            );
        } else {
            nextAttrs += ' style="width:100%;height:auto;display:block;max-width:100%;"';
        }

        if (!/preserveAspectRatio=/i.test(nextAttrs)) {
            nextAttrs += ' preserveAspectRatio="xMidYMid meet"';
        }

        return `<svg${nextAttrs}>`;
    });
}

// Initialize mermaid with a browser-focused config close to Mermaid Playground defaults.
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: MERMAID_FONT_FAMILY,
    suppressErrorRendering: true,
    flowchart: {
        htmlLabels: true,
        useMaxWidth: true,
        nodeSpacing: 40,
        rankSpacing: 50,
        padding: 12,
    },
    sequence: {
        useMaxWidth: true,
    },
    themeVariables: {
        fontFamily: MERMAID_FONT_FAMILY,
    },
});

export interface MermaidDiagramProps {
    /** The mermaid diagram code */
    code: string;
    /** Additional className for the container */
    className?: string;
}

/**
 * MermaidDiagram - Renders mermaid diagram code as SVG
 *
 * Supports all mermaid diagram types including:
 * - flowchart/graph
 * - sequence
 * - class
 * - state
 * - er (entity relationship)
 * - gantt
 * - pie
 * - mindmap
 * - timeline
 * - and more
 */
export function MermaidDiagram({ code, className }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const uniqueId = useId().replace(/:/g, '_');

    useEffect(() => {
        let cancelled = false;

        const renderDiagram = async () => {
            if (!code.trim()) {
                setSvg(null);
                setError(null);
                return;
            }

            try {
                // Reset error state
                setError(null);

                // Generate unique ID for this render
                const id = `mermaid-${uniqueId}-${Date.now()}`;
                const normalizedCode = normalizeMermaidCodeForBrowser(code);

                // Render the diagram
                const { svg: renderedSvg } = await mermaid.render(id, normalizedCode);
                const responsiveSvg = makeSvgResponsive(renderedSvg);

                if (!cancelled) {
                    setSvg(responsiveSvg);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Failed to render mermaid diagram';
                    setError(message);
                    setSvg(null);
                }
            }
        };

        renderDiagram();

        return () => {
            cancelled = true;
        };
    }, [code, uniqueId]);

    // Silently ignore mermaid syntax errors - just render nothing
    if (error) {
        return null;
    }

    if (!svg) {
        return (
            <div className={`my-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse ${className || ''}`}>
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`my-4 w-full overflow-x-auto [&_svg]:mx-auto [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full ${className || ''}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
