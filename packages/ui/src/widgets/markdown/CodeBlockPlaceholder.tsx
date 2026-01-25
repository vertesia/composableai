import React from 'react';
import { BarChart3, GitBranch, MessageSquare, Code, Image, Link } from 'lucide-react';

export type CodeBlockType = 'chart' | 'mermaid' | 'proposal' | 'code' | 'image' | 'link';

export interface CodeBlockPlaceholderProps {
    /** The type of content being loaded */
    type: CodeBlockType;
    /** Optional error message to display */
    error?: string;
    /** Callback to retry loading */
    onRetry?: () => void;
    /** Optional custom message */
    message?: string;
    /** Height hint for the placeholder (default varies by type) */
    height?: number;
}

const TYPE_CONFIG: Record<CodeBlockType, { icon: React.ElementType; label: string; defaultHeight: number }> = {
    chart: { icon: BarChart3, label: 'chart', defaultHeight: 200 },
    mermaid: { icon: GitBranch, label: 'diagram', defaultHeight: 150 },
    proposal: { icon: MessageSquare, label: 'options', defaultHeight: 100 },
    code: { icon: Code, label: 'code', defaultHeight: 80 },
    image: { icon: Image, label: 'image', defaultHeight: 150 },
    link: { icon: Link, label: 'link', defaultHeight: 24 },
};

/**
 * Placeholder component shown while code blocks are loading.
 * Provides visual feedback and error states with retry capability.
 */
export function CodeBlockPlaceholder({
    type,
    error,
    onRetry,
    message,
    height,
}: CodeBlockPlaceholderProps) {
    const config = TYPE_CONFIG[type];
    const displayHeight = height ?? config.defaultHeight;
    const isInline = type === 'link';

    if (error) {
        return (
            <div
                className={`flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5 text-destructive ${
                    isInline ? 'inline-flex px-2 py-1 text-sm' : 'p-4'
                }`}
                style={!isInline ? { minHeight: displayHeight } : undefined}
            >
                <span className="text-destructive">Failed to load {config.label}</span>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="ml-2 rounded bg-destructive/10 px-2 py-1 text-xs hover:bg-destructive/20 transition-colors"
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    const IconComponent = config.icon;

    if (isInline) {
        return (
            <span className="inline-flex items-center gap-1 text-muted animate-pulse">
                <IconComponent className="h-3 w-3" />
                <span>{message || `Loading ${config.label}...`}</span>
            </span>
        );
    }

    return (
        <div
            className="flex flex-col items-center justify-center gap-3 rounded border border-border bg-muted/30 animate-pulse"
            style={{ minHeight: displayHeight }}
        >
            <IconComponent className="h-8 w-8 text-muted" />
            <span className="text-sm text-muted">
                {message || `Loading ${config.label}...`}
            </span>
            <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="h-2 w-2 rounded-full bg-muted animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Error boundary for code block rendering.
 * Catches rendering errors and displays a fallback UI.
 */
interface CodeBlockErrorBoundaryProps {
    children: React.ReactNode;
    type: CodeBlockType;
    fallbackCode?: string;
    onError?: (error: Error) => void;
}

interface CodeBlockErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class CodeBlockErrorBoundary extends React.Component<
    CodeBlockErrorBoundaryProps,
    CodeBlockErrorBoundaryState
> {
    constructor(props: CodeBlockErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): CodeBlockErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`CodeBlock rendering error (${this.props.type}):`, error, errorInfo);
        this.props.onError?.(error);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            const { type, fallbackCode } = this.props;
            return (
                <div className="space-y-2">
                    <CodeBlockPlaceholder
                        type={type}
                        error={this.state.error?.message || 'Rendering failed'}
                        onRetry={this.handleRetry}
                    />
                    {fallbackCode && (
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted hover:text-foreground">
                                Show raw content
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                                <code>{fallbackCode}</code>
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
