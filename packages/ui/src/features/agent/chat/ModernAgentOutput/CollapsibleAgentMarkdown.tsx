import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { MarkdownRenderer, type MarkdownRendererProps } from '@vertesia/ui/widgets';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

/** Prose styling used for agent/model message markdown, shared across the conversation UI. */
export const AGENT_PROSE_CLASS = [
    'agent-markdown vprose prose max-w-none break-words text-sm leading-6 text-foreground/80',
    'prose-p:my-2 prose-p:leading-6 prose-li:my-0.5 prose-pre:my-3 prose-headings:tracking-normal',
    'prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground',
    'prose-a:text-foreground prose-a:underline prose-a:decoration-muted prose-a:underline-offset-4',
    '[&_p]:text-foreground/80 [&_li]:text-foreground/80 [&_li::marker]:text-muted',
].join(' ');

/** Clamp applied to collapsed markdown. Kept as a literal so Tailwind emits the utility. */
export const AGENT_LINE_CLAMP_CLASS =
    '[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:6]';

export const AGENT_COLLAPSE_LINES = 6;
export const AGENT_COLLAPSE_THRESHOLD = 520;

interface CollapsibleAgentMarkdownProps {
    /** Raw markdown to render. */
    children: string;
    artifactRunId?: string;
    components?: MarkdownRendererProps['components'];
    /** Disable the show more/less affordance regardless of length. */
    disableCollapse?: boolean;
    className?: string;
    'data-testid'?: string;
}

/**
 * Renders agent/model markdown with the shared prose styling and, when the content is long,
 * collapses it to a few lines behind a "Show more" / "Show less" toggle. Mirrors the treatment
 * used for summary thought prose so edit/comment cards read like ordinary model messages.
 */
export function CollapsibleAgentMarkdown({
    children,
    artifactRunId,
    components,
    disableCollapse,
    className,
    'data-testid': dataTestId,
}: CollapsibleAgentMarkdownProps) {
    const { t } = useUITranslation();
    const normalizedText = children.trim();
    const [isExpanded, setIsExpanded] = useState(false);
    const explicitLineCount = normalizedText ? normalizedText.split(/\r?\n/).length : 0;
    const isLong = normalizedText.length > AGENT_COLLAPSE_THRESHOLD || explicitLineCount > AGENT_COLLAPSE_LINES;
    const collapsed = isLong && !disableCollapse && !isExpanded;

    return (
        <div className={cn('min-w-0', className)}>
            <div
                data-testid={dataTestId}
                className={cn(AGENT_PROSE_CLASS, collapsed && AGENT_LINE_CLAMP_CLASS)}
                style={{ overflowWrap: 'anywhere' }}
            >
                <MarkdownRenderer artifactRunId={artifactRunId} components={components}>
                    {children}
                </MarkdownRenderer>
            </div>
            {isLong && !disableCollapse ? (
                <div className="mt-1.5 flex justify-end">
                    <button
                        type="button"
                        aria-expanded={isExpanded}
                        className={cn(
                            'inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors',
                            '[text-decoration:none] hover:text-foreground hover:[text-decoration:none]',
                            'focus-visible:text-foreground focus-visible:[text-decoration:none]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onClick={() => setIsExpanded((current) => !current)}
                    >
                        {isExpanded ? t('agent.showLess') : t('agent.showMore')}
                        <ChevronDown
                            className={cn('size-4 transition-transform', isExpanded && 'rotate-180')}
                            aria-hidden="true"
                        />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
