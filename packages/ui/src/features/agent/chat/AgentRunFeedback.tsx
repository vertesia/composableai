import {
    AGENT_RUN_FEEDBACK_COMMENT_MAX_LENGTH,
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
import { useRef, useState } from 'react';

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

export interface AgentRunFeedbackProps {
    /** The run being rated. */
    agentRunId: string;
    /** Rate one message rather than the run as a whole. */
    messageId?: string;
    /** Position of the rated message in the run. Sent alongside or instead of `messageId`. */
    messageSeq?: number;
    /** `compact` matches the icon-button sizing used by the conversation header's compact variant. */
    variant?: 'full' | 'compact';
    className?: string;
    /** Called after every accepted round trip, with what the server said it did with the rating. */
    onRecorded?: (payload: AgentRunFeedbackPayload, status: AgentRunFeedbackStatus) => void;
}

/**
 * Thumbs up / thumbs down on an agent run.
 *
 * The click records the rating on its own, immediately — that is the signal being collected, and
 * making the user fill a form first would cost most of it. The detail dialog then opens over the
 * top for the reason code and an optional comment; dismissing it keeps the bare rating, and
 * submitting it sends a revision of the same rating, which the server supersedes the first one
 * with.
 *
 * The outcome is read from the response's `status`, not from the HTTP code: a deployment that does
 * not run product diagnostics, and a run with no diagnosis to attach the rating to, both answer 200
 * and neither has counted anything. Saying "thanks" in those cases would be a lie, so the control
 * says the rating was not recorded and, when the feature is off entirely, stops offering itself.
 */
export function AgentRunFeedback({
    agentRunId,
    messageId,
    messageSeq,
    variant = 'full',
    className,
    onRecorded,
}: AgentRunFeedbackProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();
    const [rating, setRating] = useState<AgentRunFeedbackRating>();
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
        setRating(undefined);
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
            onRecorded?.(payload, response.status);
            if (response.status === 'recorded') {
                setRating(value);
                return response.status;
            }
            // `disabled` means no deployment-wide diagnosis pipeline; there is nothing to retry,
            // so the control removes itself rather than inviting a second useless click.
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
            const status = await send(value, false);
            if (status === 'recorded') {
                setReasonCode(undefined);
                setComment('');
                setIsDetailOpen(true);
            }
        } finally {
            setPendingRating(undefined);
        }
    };

    const handleSubmitDetail = async () => {
        if (!rating) return;
        setIsSubmittingDetail(true);
        try {
            const status = await send(rating, true);
            if (status === 'recorded') {
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
        <div className={cn('flex items-center gap-0.5', className)}>
            {thumb('up', upLabel, ThumbsUp)}
            {thumb('down', downLabel, ThumbsDown)}
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
