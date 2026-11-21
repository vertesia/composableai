import type { AgentMessage } from '@vertesia/common';
import { Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Lock } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
    getToolApprovalArguments,
    summarizeToolArguments,
    type ToolArgumentPreview,
    type ToolArgumentRow,
    type ToolArgumentValue,
} from './ModernAgentOutput/toolApprovalArguments';

type Translate = ReturnType<typeof useUITranslation>['t'];

export interface ToolApprovalArgumentsProps {
    /** The call's arguments as the prompt carries them, secrets already redacted. */
    input: unknown;
    className?: string;
}

/**
 * The arguments of a tool call waiting for approval, in readable form: one row per top-level argument, the most
 * informative first, the rest behind "Show all arguments". Renders nothing for a call without arguments.
 */
export function ToolApprovalArguments({ input, className }: ToolApprovalArgumentsProps) {
    const { t } = useUITranslation();
    const summary = useMemo(() => summarizeToolArguments(input), [input]);
    const [showAll, setShowAll] = useState(false);
    const listId = useId();

    if (summary.rows.length === 0) return null;
    const hiddenCount = summary.rows.length - summary.visibleCount;
    const rows = showAll ? summary.rows : summary.rows.slice(0, summary.visibleCount);

    return (
        <section
            className={cn('rounded-md border border-border bg-muted px-3 py-2 text-xs', className)}
            aria-label={t('agent.toolApprovalArguments.label')}
            data-tool-approval-arguments
        >
            <dl id={listId} className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-3 gap-y-1.5">
                {rows.map((row) => (
                    <ArgumentRow key={row.key} row={row} t={t} />
                ))}
            </dl>
            {hiddenCount > 0 && (
                <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1 -ms-2"
                    aria-expanded={showAll}
                    aria-controls={listId}
                    onClick={() => setShowAll((value) => !value)}
                >
                    {showAll
                        ? t('agent.toolApprovalArguments.showFewer')
                        : t('agent.toolApprovalArguments.showAll', { count: summary.rows.length })}
                </Button>
            )}
        </section>
    );
}

/** {@link ToolApprovalArguments} for a tool approval prompt, or nothing for any other message. */
export function toolApprovalArgumentsFor(message: AgentMessage, className?: string) {
    const input = getToolApprovalArguments(message);
    if (input === undefined) return undefined;
    return <ToolApprovalArguments input={input} className={className} />;
}

function ArgumentRow({ row, t }: { row: ToolArgumentRow; t: Translate }) {
    return (
        <>
            <dt className="min-w-0 wrap-break-word font-medium text-muted">{row.label}</dt>
            <dd className="m-0 min-w-0 wrap-break-word text-foreground">
                <ArgumentValue value={row.value} t={t} />
            </dd>
        </>
    );
}

function ArgumentValue({ value, t }: { value: ToolArgumentValue; t: Translate }) {
    switch (value.kind) {
        case 'text':
            return value.long ? <LongText text={value.text} t={t} /> : <span>{value.text}</span>;
        case 'redacted':
            return <Redacted t={t} />;
        case 'empty':
            return <span className="text-muted italic">{t('agent.toolApprovalArguments.empty')}</span>;
        case 'list':
            return (
                <div>
                    <span className="text-muted">
                        {t('agent.toolApprovalArguments.itemCount', { count: value.count })}
                    </span>
                    {value.items.length > 0 && (
                        <ul className="m-0 mt-0.5 list-disc ps-4">
                            {value.items.map((item, index) => (
                                // Previews of the first items of a list: their position is their identity.
                                <li key={index}>
                                    <Preview preview={item} t={t} />
                                </li>
                            ))}
                            {value.count > value.items.length && (
                                <li className="list-none text-muted">
                                    {t('agent.toolApprovalArguments.more', {
                                        number: value.count - value.items.length,
                                    })}
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            );
        case 'object':
            return (
                <ul className="m-0 list-none p-0">
                    {value.fields.map((field) => (
                        <li key={field.key}>
                            <span className="text-muted">{field.label}: </span>
                            <Preview preview={field.preview} t={t} />
                        </li>
                    ))}
                    {value.count > value.fields.length && (
                        <li className="text-muted">
                            {t('agent.toolApprovalArguments.more', { number: value.count - value.fields.length })}
                        </li>
                    )}
                </ul>
            );
        case 'schema':
            return (
                <div>
                    <span className="text-muted">
                        {t('agent.toolApprovalArguments.schema', {
                            count: value.properties.length + value.moreProperties,
                        })}
                    </span>
                    <ul className="m-0 mt-0.5 list-none p-0">
                        {value.properties.map((property) => (
                            <li key={property.name}>
                                <span className="font-mono">{property.name}</span>
                                {property.type && <span className="text-muted">: {property.type}</span>}
                                {property.required && (
                                    <span className="text-muted"> ({t('agent.toolApprovalArguments.required')})</span>
                                )}
                                {property.enumValues && (
                                    <span className="text-muted">
                                        {' '}
                                        —{' '}
                                        {t('agent.toolApprovalArguments.oneOf', {
                                            values: property.enumValues.join(', '),
                                        })}
                                    </span>
                                )}
                            </li>
                        ))}
                        {value.moreProperties > 0 && (
                            <li className="text-muted">
                                {t('agent.toolApprovalArguments.more', { number: value.moreProperties })}
                            </li>
                        )}
                    </ul>
                </div>
            );
    }
}

function Preview({ preview, t }: { preview: ToolArgumentPreview; t: Translate }) {
    switch (preview.kind) {
        case 'text':
            return <span>{preview.text}</span>;
        case 'redacted':
            return <Redacted t={t} />;
        case 'empty':
            return <span className="text-muted italic">{t('agent.toolApprovalArguments.empty')}</span>;
        case 'list':
            return (
                <span className="text-muted">
                    {t('agent.toolApprovalArguments.itemCount', { count: preview.count })}
                </span>
            );
        case 'object':
            return (
                <span className="text-muted">
                    {t('agent.toolApprovalArguments.fieldCount', { count: preview.count })}
                </span>
            );
    }
}

function Redacted({ t }: { t: Translate }) {
    return (
        <span className="inline-flex items-center gap-1 text-muted">
            <Lock className="size-3" aria-hidden="true" />
            {t('agent.toolApprovalArguments.redacted')}
        </span>
    );
}

function LongText({ text, t }: { text: string; t: Translate }) {
    const [expanded, setExpanded] = useState(false);
    const textId = useId();
    return (
        <div>
            <p id={textId} className={cn('m-0 whitespace-pre-wrap', !expanded && 'line-clamp-3')}>
                {text}
            </p>
            <Button
                variant="ghost"
                size="xs"
                className="-ms-2"
                aria-expanded={expanded}
                aria-controls={textId}
                onClick={() => setExpanded((value) => !value)}
            >
                {expanded ? t('agent.showLess') : t('agent.showMore')}
            </Button>
        </div>
    );
}
