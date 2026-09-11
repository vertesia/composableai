import {
    AGENT_RUN_FEEDBACK_COMMENT_MAX_LENGTH,
    type AgentMessage,
    type AgentRunFeedbackEntry,
    type AgentRunFeedbackPayload,
    type AgentRunFeedbackRating,
    type AgentRunFeedbackReasonCode,
    type AgentRunFeedbackStatus,
} from '@vertesia/common';
import {
    Button,
    cn,
    FormItem,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    SelectBox,
    Textarea,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Which rating each reason code belongs to.
 *
 * Written as a `Record` over the published enum on purpose: adding a code to
 * `AgentRunFeedbackReasonCode` breaks this file until someone decides where it belongs, so the
 * picker can never silently stop offering a code the API accepts. `other` is offered on both sides.
 */
const REASON_CODE_RATINGS: Record<AgentRunFeedbackReasonCode, readonly AgentRunFeedbackRating[]> = {
    accurate: ['up'],
    helpful: ['up'],
    fast: ['up'],
    well_explained: ['up'],
    wrong_result: ['down'],
    incomplete: ['down'],
    misunderstood_request: ['down'],
    too_slow: ['down'],
    tool_failure: ['down'],
    unsafe_action: ['down'],
    other: ['up', 'down'],
};

const REASON_CODES = Object.keys(REASON_CODE_RATINGS) as AgentRunFeedbackReasonCode[];

export function agentRunFeedbackReasonCodes(rating: AgentRunFeedbackRating): AgentRunFeedbackReasonCode[] {
    return REASON_CODES.filter((code) => REASON_CODE_RATINGS[code].includes(rating));
}

/**
 * Opaque identifier of one message inside its run, used as the feedback `message_id`. Agent
 * messages carry no id of their own; the workstream plus the timestamp is what the transcript
 * itself keys on.
 */
export function agentMessageFeedbackId(message: Pick<AgentMessage, 'workstream_id' | 'timestamp'>): string {
    return `${message.workstream_id || 'main'}:${message.timestamp}`;
}

/** Idempotency key for one submission; the server counts a retried id once. */
function newFeedbackId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** `recorded` and `replaced` both mean the rating is in; only `disabled` is a non-outcome. */
function isAccepted(status: AgentRunFeedbackStatus): boolean {
    return status === 'recorded' || status === 'replaced';
}

/** The subject of one rating: the run as a whole, or one message of it. */
interface FeedbackScope {
    agentRunId: string;
    messageId?: string;
    messageSeq?: number;
}

function scopeKeyOf({ agentRunId, messageId, messageSeq }: FeedbackScope): string {
    return `${agentRunId}|${messageId ?? ''}|${messageSeq ?? ''}`;
}

function entryScopeKey(agentRunId: string, entry: Pick<AgentRunFeedbackEntry, 'message_id' | 'message_seq'>): string {
    return scopeKeyOf({ agentRunId, messageId: entry.message_id, messageSeq: entry.message_seq });
}

/**
 * The stored rating of the current user for every scope of one run, read once from the run
 * document so a reload shows the thumbs where they were left.
 *
 * `null` while the run has not been read yet, so a control can tell "nothing recorded" from
 * "not known yet".
 */
interface AgentRunFeedbackHydration {
    agentRunId: string;
    ratingFor(scope: FeedbackScope): AgentRunFeedbackRating | undefined;
    /** A rating this session just recorded, so a remounted control shows it without a refetch. */
    remember(scope: FeedbackScope, rating: AgentRunFeedbackRating): void;
}

const AgentRunFeedbackContext = createContext<AgentRunFeedbackHydration | null>(null);

/**
 * The server stores the rater as a principal ref (`user:<id>`), the same string the auth layer
 * builds from the token: `user_id` when the token carries one, else `sub`.
 */
function currentPrincipalRef(user: { sub?: string; user_id?: string } | undefined): string | undefined {
    const id = user?.user_id ?? user?.sub;
    return id ? `user:${id}` : undefined;
}

/**
 * The current user's active rating per scope. A replaced entry is history; among the rest the
 * latest `rated_at` wins, which is also what the server's one-vote-per-scope rule keeps.
 */
export function activeRatingsByScope(
    agentRunId: string,
    entries: readonly AgentRunFeedbackEntry[] | undefined,
    principalRef: string | undefined,
): Map<string, AgentRunFeedbackRating> {
    const latest = new Map<string, AgentRunFeedbackEntry>();
    if (!principalRef) return new Map();
    for (const entry of entries ?? []) {
        if (entry.user_id !== principalRef || entry.replaced_at) continue;
        const key = entryScopeKey(agentRunId, entry);
        const seen = latest.get(key);
        if (!seen || seen.rated_at < entry.rated_at) latest.set(key, entry);
    }
    return new Map(Array.from(latest, ([key, entry]) => [key, entry.rating]));
}

/**
 * Loads the ratings the current user already gave on `agentRunId` and hands them to every
 * {@link AgentRunFeedback} rendered underneath, so the thumbs survive a reload of the
 * conversation. One read per run, however many messages carry a control.
 *
 * Without a provider the controls still work; they just start blank.
 */
export function AgentRunFeedbackProvider({ agentRunId, children }: { agentRunId: string; children: ReactNode }) {
    const { client, user } = useUserSession();
    const principalRef = currentPrincipalRef(user);
    const [loaded, setLoaded] = useState<{ agentRunId: string; ratings: Map<string, AgentRunFeedbackRating> }>();
    const [remembered, setRemembered] = useState<Map<string, AgentRunFeedbackRating>>(() => new Map());
    // Read through a ref: the run is re-read when the run or the user changes, not whenever the
    // session hands out a new client object.
    const clientRef = useRef(client);
    clientRef.current = client;

    useEffect(() => {
        let cancelled = false;
        // The run document carries the retained entries; a failure here only costs the hydration,
        // never the ability to rate.
        clientRef.current.agents
            .retrieve(agentRunId)
            .then((run) => {
                if (cancelled) return;
                setLoaded({ agentRunId, ratings: activeRatingsByScope(agentRunId, run.feedback, principalRef) });
            })
            .catch(() => {
                if (!cancelled) setLoaded({ agentRunId, ratings: new Map() });
            });
        return () => {
            cancelled = true;
        };
    }, [agentRunId, principalRef]);

    const value = useMemo<AgentRunFeedbackHydration>(
        () => ({
            agentRunId,
            ratingFor: (scope) => {
                const key = scopeKeyOf(scope);
                return remembered.get(key) ?? (loaded?.agentRunId === agentRunId ? loaded.ratings.get(key) : undefined);
            },
            remember: (scope, rating) => {
                setRemembered((previous) => new Map(previous).set(scopeKeyOf(scope), rating));
            },
        }),
        [agentRunId, loaded, remembered],
    );

    return <AgentRunFeedbackContext.Provider value={value}>{children}</AgentRunFeedbackContext.Provider>;
}

export interface AgentRunFeedbackProps {
    /** The run being rated. */
    agentRunId: string;
    /** Rate one message rather than the run as a whole. */
    messageId?: string;
    /** Position of the rated message in the run. Sent alongside or instead of `messageId`. */
    messageSeq?: number;
    /** `compact` matches the icon-button sizing used by the conversation header's compact variant. */
    variant?: 'full' | 'compact';
    /** `inline` fades the control until the pointer is over the message it belongs to. */
    tone?: 'default' | 'inline';
    className?: string;
    /** Called after every accepted round trip, with what the server said it did with the rating. */
    onRecorded?: (payload: AgentRunFeedbackPayload, status: AgentRunFeedbackStatus) => void;
}

/**
 * Thumbs up / thumbs down on an agent run.
 *
 * The click records the rating on its own, immediately — that is the signal being collected, and
 * making the user fill a form first would cost most of it. Nothing opens on its own: once the
 * rating is in, a quiet "Tell us more" link appears next to the thumbs, and only that opens the
 * detail dialog for the reason code and an optional comment. Submitting it sends a revision of the
 * same rating, which the server supersedes the first one with.
 *
 * Every submission carries a fresh `feedback_id`: it is the server's idempotency key, so a retried
 * request cannot count twice, and a second vote by the same user on the same scope replaces the
 * first (`replaced`) rather than adding to it. Both `recorded` and `replaced` mean the rating is in.
 *
 * The outcome is read from the response's `status`, not from the HTTP code: a deployment that does
 * not collect ratings answers 200 with `disabled` and has counted nothing. Saying "thanks" there
 * would be a lie, so the control says the rating was not recorded and stops offering itself.
 */
export function AgentRunFeedback({
    agentRunId,
    messageId,
    messageSeq,
    variant = 'full',
    tone = 'default',
    className,
    onRecorded,
}: AgentRunFeedbackProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();
    const hydration = useContext(AgentRunFeedbackContext);
    const [ownRating, setOwnRating] = useState<AgentRunFeedbackRating>();
    // What this session recorded wins over what the run document said at load time; a stored
    // rating from a previous session fills in when nothing was clicked here yet.
    const rating =
        ownRating ??
        (hydration?.agentRunId === agentRunId ? hydration.ratingFor({ agentRunId, messageId, messageSeq }) : undefined);
    const [pendingRating, setPendingRating] = useState<AgentRunFeedbackRating>();
    const [isUnavailable, setIsUnavailable] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isSubmittingDetail, setIsSubmittingDetail] = useState(false);
    const [reasonCode, setReasonCode] = useState<AgentRunFeedbackReasonCode>();
    const [comment, setComment] = useState('');

    const scope = messageId !== undefined || messageSeq !== undefined ? 'message' : 'run';

    /**
     * The subject this control is rating. Every piece of state below belongs to it and to nothing
     * else, so when it changes they all have to go.
     *
     * Without this the component kept its rating, its reason code, its comment and its open dialog
     * across a switch to a different run: the previous conversation's thumb stayed lit on the new
     * one, and submitting a dialog left open across the switch sent the old comment against the new
     * run's id — `send` reads `agentRunId` at call time, so the request went to the new run
     * carrying text written about the old one. A parent that remounts per run hid it; the component
     * is exported from `@vertesia/ui` and cannot assume one does.
     *
     * Reset during render, which is React's documented way to adjust state when a prop changes: it
     * re-renders before committing, so nothing paints with the stale value the way a `useEffect`
     * reset would.
     */
    const scopeKey = `${agentRunId}|${messageId ?? ''}|${messageSeq ?? ''}`;
    const [lastScopeKey, setLastScopeKey] = useState(scopeKey);
    const currentScopeKey = useRef(scopeKey);
    if (lastScopeKey !== scopeKey) {
        setLastScopeKey(scopeKey);
        currentScopeKey.current = scopeKey;
        setOwnRating(undefined);
        setPendingRating(undefined);
        setIsDetailOpen(false);
        setIsSubmittingDetail(false);
        setReasonCode(undefined);
        setComment('');
        // `isUnavailable` is NOT reset: `disabled` is a property of the deployment, not of the run,
        // so a control that has already learned the pipeline is off stays hidden rather than
        // re-offering itself on every switch and collecting clicks nothing records.
    }

    const send = async (
        value: AgentRunFeedbackRating,
        detail: boolean,
    ): Promise<AgentRunFeedbackStatus | undefined> => {
        const payload: AgentRunFeedbackPayload = {
            feedback_id: newFeedbackId(),
            rating: value,
            ...(detail && reasonCode !== undefined ? { reason_code: reasonCode } : {}),
            ...(detail && comment.trim().length > 0 ? { comment: comment.trim() } : {}),
            ...(messageId !== undefined ? { message_id: messageId } : {}),
            ...(messageSeq !== undefined ? { message_seq: messageSeq } : {}),
        };
        // Captured before the await: a response that lands after the user has moved to another run
        // describes a subject this control is no longer showing, and applying it would light a
        // thumb for a rating given somewhere else.
        const sentScopeKey = scopeKey;
        try {
            const response = await client.agents.recordFeedback(agentRunId, payload);
            if (sentScopeKey !== currentScopeKey.current) return undefined;
            if (isAccepted(response.status)) {
                onRecorded?.(payload, response.status);
                setOwnRating(value);
                hydration?.remember({ agentRunId, messageId, messageSeq }, value);
                return response.status;
            }
            // `disabled` means this deployment collects no ratings; there is nothing to retry, so
            // the control removes itself rather than inviting a second useless click.
            setIsUnavailable(response.status === 'disabled');
            toast({
                status: 'info',
                title: t('agent.feedback.notRecorded'),
                description: t(`agent.feedback.status.${response.status}`),
                duration: 4000,
            });
            return response.status;
        } catch (error: unknown) {
            if (sentScopeKey !== currentScopeKey.current) return undefined;
            toast({
                status: 'error',
                title: t('agent.feedback.failed'),
                description: error instanceof Error ? error.message : String(error),
                duration: 4000,
            });
            return undefined;
        }
    };

    const handleRate = async (value: AgentRunFeedbackRating) => {
        if (pendingRating) return;
        setPendingRating(value);
        try {
            await send(value, false);
        } finally {
            setPendingRating(undefined);
        }
    };

    const openDetail = () => {
        if (!rating) return;
        setIsDetailOpen(true);
    };

    const handleSubmitDetail = async () => {
        if (!rating) return;
        setIsSubmittingDetail(true);
        try {
            const status = await send(rating, true);
            if (status && isAccepted(status)) {
                setIsDetailOpen(false);
                toast({ status: 'success', title: t('agent.feedback.thanks'), duration: 2000 });
            }
        } finally {
            setIsSubmittingDetail(false);
        }
    };

    if (isUnavailable) return null;

    const isCompact = variant === 'compact';
    const upLabel = scope === 'message' ? t('agent.feedback.rateMessageUp') : t('agent.feedback.rateRunUp');
    const downLabel = scope === 'message' ? t('agent.feedback.rateMessageDown') : t('agent.feedback.rateRunDown');

    const thumb = (value: AgentRunFeedbackRating, label: string, Icon: typeof ThumbsUp) => (
        <VTooltip description={label} asChild>
            <Button
                type="button"
                variant="ghost"
                size={isCompact ? 'icon' : 'xs'}
                aria-label={label}
                aria-pressed={rating === value}
                disabled={pendingRating !== undefined}
                onClick={() => void handleRate(value)}
                className={cn(
                    'transition-colors duration-200 rounded-md',
                    isCompact && 'size-8 rounded-lg',
                    rating === value && (value === 'up' ? 'text-success' : 'text-destructive'),
                )}
            >
                <Icon className="size-4" />
            </Button>
        </VTooltip>
    );

    return (
        <div
            className={cn(
                'flex items-center gap-0.5',
                // Inline under an answer the control should not compete with the text: it sits
                // faded until the pointer is over the message, and stays visible once a rating is
                // in so the user can find "Tell us more" again.
                tone === 'inline' &&
                    !rating &&
                    'opacity-40 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100',
                className,
            )}
        >
            {thumb('up', upLabel, ThumbsUp)}
            {thumb('down', downLabel, ThumbsDown)}
            {rating && !isDetailOpen && (
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={openDetail}
                    className="ms-1 text-xs text-muted hover:text-foreground"
                >
                    {t('agent.feedback.tellUsMore')}
                </Button>
            )}
            <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} size="md" disableCloseOnClickOutside>
                <ModalTitle>{t('agent.feedback.detailTitle')}</ModalTitle>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-muted">{t('agent.feedback.detailHelp')}</p>
                        <FormItem label={t('agent.feedback.reasonLabel')}>
                            <SelectBox<AgentRunFeedbackReasonCode>
                                options={rating ? agentRunFeedbackReasonCodes(rating) : []}
                                value={reasonCode}
                                onChange={setReasonCode}
                                optionLabel={(code) => t(`agent.feedback.reason.${code}`)}
                                placeholder={t('agent.feedback.reasonPlaceholder')}
                                aria-label={t('agent.feedback.reasonLabel')}
                                isClearable
                            />
                        </FormItem>
                        <FormItem label={t('agent.feedback.commentLabel')} helpText={t('agent.feedback.commentHelp')}>
                            <Textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                maxLength={AGENT_RUN_FEEDBACK_COMMENT_MAX_LENGTH}
                                minLines={3}
                                maxLines={8}
                                placeholder={t('agent.feedback.commentPlaceholder')}
                            />
                        </FormItem>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" onClick={() => setIsDetailOpen(false)} disabled={isSubmittingDetail}>
                        {t('agent.feedback.skip')}
                    </Button>
                    <Button
                        onClick={() => void handleSubmitDetail()}
                        isLoading={isSubmittingDetail}
                        disabled={isSubmittingDetail || (reasonCode === undefined && comment.trim().length === 0)}
                    >
                        {t('agent.feedback.submit')}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
}
