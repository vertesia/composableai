import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid with default config
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
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

                // Render the diagram
                const { svg: renderedSvg } = await mermaid.render(id, code.trim());

                if (!cancelled) {
                    setSvg(renderedSvg);
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

    if (error) {
        return (
            <div className={`my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className || ''}`}>
                <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Mermaid Diagram Error
                </div>
                <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap overflow-x-auto">
                    {error}
                </pre>
                <details className="mt-2">
                    <summary className="text-xs text-red-500 dark:text-red-400 cursor-pointer">
                        Show diagram code
                    </summary>
                    <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-x-auto">
                        {code}
                    </pre>
                </details>
            </div>
        );
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
            className={`my-4 overflow-x-auto ${className || ''}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
