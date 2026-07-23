import type { AgentResourceReference } from '@vertesia/common';
import { Badge, Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { useAgentResourceResolver } from '@vertesia/ui/widgets';
import { getResourceActionVariant, getResourceIcon } from './resourceLinks';

interface ResourceChipProps {
    resource: AgentResourceReference;
    /** Originating run, passed to the resolver for run-scoped resources. */
    workflowRunId?: string;
    /** Hide the action badge when surrounding text already communicates the action. */
    showAction?: boolean;
    className?: string;
}

/**
 * A compact resource chip for something an agent tool created/updated/deleted. The host resolver may
 * make it navigable (NavLink applies tenant sticky params), activate a host callback, or leave it
 * non-interactive.
 */
export function ResourceChip({ resource, workflowRunId, showAction = true, className }: ResourceChipProps) {
    const { t } = useUITranslation();
    const resolve = useAgentResourceResolver();
    const target = resolve(resource, { workflowRunId, source: 'structured' });
    const Icon = getResourceIcon(resource.type);
    // Literal keys (not a dynamic lookup) so i18next-cli can statically extract them.
    const actionLabel =
        resource.action === 'created'
            ? t('agent.resourceActionCreated')
            : resource.action === 'deleted'
              ? t('agent.resourceActionDeleted')
              : t('agent.resourceActionUpdated');

    const body = (
        <>
            <Icon className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
            <span className="truncate">{resource.label}</span>
            {showAction && (
                <Badge variant={getResourceActionVariant(resource.action)} className="shrink-0 px-1.5 py-0 text-[10px]">
                    {actionLabel}
                </Badge>
            )}
        </>
    );

    const baseClass = cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs',
        className,
    );

    if (target.kind === 'navigate') {
        return (
            <NavLink
                href={target.href}
                topLevelNav
                className={cn(baseClass, 'font-medium transition-colors hover:bg-muted/60')}
            >
                {body}
            </NavLink>
        );
    }

    if (target.kind === 'activate') {
        return (
            <Button
                variant="unstyled"
                onClick={target.onActivate}
                className={cn(baseClass, 'font-medium transition-colors hover:bg-muted/60')}
            >
                {body}
            </Button>
        );
    }

    // Deleted or unresolvable resource: no navigation target, render a non-interactive chip.
    return <span className={cn(baseClass, 'text-muted')}>{body}</span>;
}

interface ResourceActivityLinkListProps {
    resources: AgentResourceReference[];
    workflowRunId?: string;
    className?: string;
}

/** Inline action + deep-link presentation for completed tool timeline rows. */
export function ResourceActivityLinkList({ resources, workflowRunId, className }: ResourceActivityLinkListProps) {
    const { t } = useUITranslation();
    if (resources.length === 0) return null;

    return (
        <div
            className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}
            data-agent-resource-activity
        >
            {resources.map((resource) => {
                const actionLabel =
                    resource.action === 'created'
                        ? t('agent.resourceActionCreated')
                        : resource.action === 'deleted'
                          ? t('agent.resourceActionDeleted')
                          : t('agent.resourceActionUpdated');
                return (
                    <span
                        key={`${resource.type}:${resource.id}:${resource.action}`}
                        className="inline-flex min-w-0 items-center gap-1.5"
                    >
                        <span className="shrink-0 text-sm text-muted">{actionLabel}</span>
                        <ResourceChip
                            resource={resource}
                            workflowRunId={workflowRunId}
                            showAction={false}
                            className="py-0.5"
                        />
                    </span>
                );
            })}
        </div>
    );
}

interface ResourceChipListProps {
    resources: AgentResourceReference[];
    workflowRunId?: string;
    className?: string;
}

export function ResourceChipList({ resources, workflowRunId, className }: ResourceChipListProps) {
    if (resources.length === 0) return null;
    return (
        <div className={cn('flex flex-wrap gap-1.5', className)}>
            {resources.map((resource) => (
                <ResourceChip
                    key={`${resource.type}:${resource.id}:${resource.action}`}
                    resource={resource}
                    workflowRunId={workflowRunId}
                />
            ))}
        </div>
    );
}
