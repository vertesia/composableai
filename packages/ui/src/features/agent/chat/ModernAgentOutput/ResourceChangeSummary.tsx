import type { AgentResourceReference } from '@vertesia/common';
import { Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useState } from 'react';
import { ResourceChipList } from './ResourceChip';

const COLLAPSE_THRESHOLD = 5;

interface ResourceChangeSummaryProps {
    resources: AgentResourceReference[];
    workflowRunId?: string;
    className?: string;
}

/**
 * End-of-turn summary listing every resource the assistant created/updated/deleted during the turn,
 * as deep-linkable chips. Rendered once the turn is complete, from structured tool metadata rather
 * than parsed prose. Collapses to the first few entries with a "view all" toggle when long.
 */
export function ResourceChangeSummary({ resources, workflowRunId, className }: ResourceChangeSummaryProps) {
    const { t } = useUITranslation();
    const [expanded, setExpanded] = useState(false);

    if (resources.length === 0) return null;

    const collapsible = resources.length > COLLAPSE_THRESHOLD;
    const visible = collapsible && !expanded ? resources.slice(0, COLLAPSE_THRESHOLD) : resources;

    return (
        <div className={cn('mx-auto w-full max-w-3xl py-2', className)} data-agent-resource-summary>
            <div className="mb-2 text-xs font-medium text-muted">{t('agent.resourcesChanged')}</div>
            <ResourceChipList resources={visible} workflowRunId={workflowRunId} />
            {collapsible && (
                <Button variant="outline" size="xs" className="mt-2" onClick={() => setExpanded((prev) => !prev)}>
                    {expanded ? t('agent.resourceShowLess') : t('agent.resourceViewAll', { total: resources.length })}
                </Button>
            )}
        </div>
    );
}
