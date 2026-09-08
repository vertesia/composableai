import { InteractionStatus } from '@vertesia/common';
import { Badge } from '@vertesia/ui/core';
import type { ReactNode } from 'react';

/**
 * The parts of an interaction reference the display helpers below read. Kept structural so runs,
 * facet buckets and full interactions can all be passed as-is.
 */
export interface InteractionDisplayRef {
    name?: string;
    version?: number;
    status?: InteractionStatus;
}

/**
 * Namespaces that a ref actually uses as a type prefix. Every other colon in a ref belongs to the
 * name itself (`main:rag-agent`, `nfwf-chatbot:main:rag-agent`), so it must not become a badge.
 */
const INTERACTION_TYPES: string[] = ['sys', 'app', 'tmp'];

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Split `<type>:<rest>` into the type badge and the label to display; untyped refs keep their name. */
export function splitInteractionType(name: string): { type?: string; label: string } {
    const separator = name.indexOf(':');
    const type = separator > 0 ? name.slice(0, separator) : undefined;
    return type && INTERACTION_TYPES.includes(type) ? { type, label: name.slice(separator + 1) } : { label: name };
}

/**
 * Pick the name to display for an interaction reference: the ref's own name, then the fallbacks —
 * a run's `interaction_name` / raw ref string, a facet bucket's id — in order.
 *
 * A bare ObjectId is never a name: it is what a deleted stored interaction leaves behind once the
 * server can no longer resolve it. Those candidates are skipped, and if nothing else is left the
 * id becomes a short "deleted" label instead, so a run row and the facet option that filters for
 * it name the missing interaction identically. Returns undefined when there is no id either.
 */
export function resolveInteractionName(
    ref: InteractionDisplayRef | undefined,
    ...fallbacks: (string | undefined)[]
): string | undefined {
    const candidates = [ref?.name, ...fallbacks].filter((candidate): candidate is string => !!candidate);
    const name = candidates.find((candidate) => !OBJECT_ID_RE.test(candidate));
    if (name) return name;
    const id = candidates[0];
    return id ? `Deleted interaction (~${id.slice(-8)})` : undefined;
}

/**
 * A reference the server couldn't resolve carries neither a version nor a status; it has no status
 * worth badging.
 */
export function isUnresolvedInteractionRef(ref: InteractionDisplayRef | undefined): boolean {
    return !!ref && ref.version === 0 && ref.status === InteractionStatus.unknown;
}

interface InteractionStatusBadgeProps {
    interaction: InteractionDisplayRef;
    className?: string;
}

export function InteractionStatusBadge({ interaction, className }: InteractionStatusBadgeProps) {
    let variant: 'success' | 'info' | 'destructive' | 'default' = 'success';
    switch (interaction.status) {
        case InteractionStatus.published:
            variant = 'success';
            break;
        case InteractionStatus.archived:
            variant = 'destructive';
            break;
        case InteractionStatus.code:
            variant = 'info';
            break;
    }
    const version = interaction.version ? `v${interaction.version}` : '';
    const status = interaction.status && interaction.status !== InteractionStatus.unknown ? interaction.status : '';
    const text = [version, status].filter(Boolean).join(' ');
    // Nothing resolved (an unresolved ref, or a bucket carrying neither field) — no badge at all.
    if (!text) return null;
    return (
        <Badge variant={variant} className={className}>
            {text}
        </Badge>
    );
}

interface InteractionLabelProps {
    /** The resolved reference, when the server could resolve one. */
    interaction?: InteractionDisplayRef;
    /**
     * Names to fall back on, in order, when the ref carries no usable name — a run's
     * `interaction_name`, the raw ref string it was launched with, a facet bucket id.
     */
    fallbacks?: (string | undefined)[];
    /** Rendered in place of the label when no name resolves at all. */
    fallbackNode?: ReactNode;
}

/**
 * How every run listing names the interaction it ran: the name with its `sys`/`app`/`tmp`
 * namespace lifted into its own badge, above the version/status badge. Keep listings on this
 * component so a row, its quick filter and the interaction facet never disagree.
 */
export function InteractionLabel({ interaction, fallbacks = [], fallbackNode = null }: InteractionLabelProps) {
    const name = resolveInteractionName(interaction, ...fallbacks);
    if (!name) {
        return <>{fallbackNode}</>;
    }
    const { type, label } = splitInteractionType(name);
    // InteractionStatusBadge renders null for an unresolved ref, so skip the row entirely here
    // rather than emit an empty badge line.
    const showStatus = !!interaction && !isUnresolvedInteractionRef(interaction);
    return (
        <>
            {label}
            {(type || showStatus) && (
                <div className="flex items-center mt-1.5 shrink-0 gap-2">
                    {type && <Badge variant="secondary">{type}</Badge>}
                    {showStatus && interaction && <InteractionStatusBadge interaction={interaction} />}
                </div>
            )}
        </>
    );
}
