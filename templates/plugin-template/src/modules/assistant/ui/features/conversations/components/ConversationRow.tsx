import type { AgentRunSearchHit } from '@vertesia/common';
import { Badge } from '@vertesia/ui/core';
import { useLocaleFormat } from '@vertesia/ui/i18n';
import { InlineFilterButton } from '../../../../../../ui/shell/components/InlineFilterButton';
import type { FilterableField } from '../types';
import { statusVariant } from '../utils';

interface ConversationRowProps {
    hit: AgentRunSearchHit;
    t: (key: string, opts?: Record<string, unknown>) => string;
    onAddFilter: (name: FilterableField, value: string, label: string) => void;
    onOpen: (id: string) => void;
}

export function ConversationRow({ hit, t, onAddFilter, onOpen }: ConversationRowProps) {
    const { formatDateTime } = useLocaleFormat();
    const topic = hit.topic || hit.title || t('conversations.untitled');
    const interaction = hit.interaction;
    const interactionLabel = hit.interaction_name || interaction;
    const started = formatDateTime(hit.started_at);
    const status = hit.status;

    return (
        <tr className="cursor-pointer hover:bg-muted/50" onClick={() => onOpen(hit.id)}>
            <td className="max-w-0">
                <div className="font-medium line-clamp-2 pe-4" title={topic}>
                    {topic}
                </div>
            </td>
            <td className="group/agent">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{interactionLabel ?? '—'}</span>
                    {interaction && (
                        <InlineFilterButton
                            tooltip={t('conversations.filterByValue', { value: interactionLabel ?? interaction })}
                            hoverClass="group-hover/agent:opacity-100"
                            onClick={() => onAddFilter('agent', interaction, interactionLabel ?? interaction)}
                        />
                    )}
                </div>
            </td>
            <td className="group/status">
                <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(status)}>{status ?? '—'}</Badge>
                    {status && (
                        <InlineFilterButton
                            tooltip={t('conversations.filterByValue', { value: status })}
                            hoverClass="group-hover/status:opacity-100"
                            onClick={() => onAddFilter('status', status, status)}
                        />
                    )}
                </div>
            </td>
            <td className="text-sm text-muted-foreground">{started}</td>
        </tr>
    );
}
