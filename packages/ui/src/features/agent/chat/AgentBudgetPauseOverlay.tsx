import type { VertesiaClient } from '@vertesia/client';
import { useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { AlertTriangle } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AskUserOption } from './AskUserWidget';
import { type BudgetPause, parseBudgetAmount, suggestedBudgetAllocation } from './budgetPause';
import { ComposerOverlay, ComposerOverlayQuestion } from './ComposerOverlay';

const ALLOCATE_OPTION = 'allocate';
const STOP_OPTION = 'stop';

export interface AgentBudgetRequestContext {
    agentRunId: string;
    pause: BudgetPause;
    suggestedTokens: number;
    suggestedUsd?: number;
    allocateUsd?: (additionalUsd: number) => Promise<boolean>;
    /** Returns false on failure or when disabled, already submitting, or awaiting server acknowledgement. */
    allocateBudget: (additionalTokens: number) => Promise<boolean>;
    stop?: () => void;
    disabled: boolean;
    isSubmitting: boolean;
    /** Allocation or application callback failure. Custom renderers own how this is displayed. */
    error?: unknown;
}

export interface AgentBudgetRequestOverrides {
    /** Called once per pause in a mounted conversation when controls are enabled; supports automatic allocation. */
    onBudgetRequest?: (request: AgentBudgetRequestContext) => void | Promise<void>;
    /** Replaces the token prompt. Return null for no UI. Either override suppresses the default prompt. */
    renderBudgetRequest?: (request: AgentBudgetRequestContext) => ReactNode;
}

interface AgentBudgetPauseOverlayProps extends AgentBudgetRequestOverrides {
    client: VertesiaClient;
    agentRunId: string;
    pause: BudgetPause;
    /** Ends the paused task; absent when the viewer cannot control the run. */
    onStop?: () => void;
    disabled?: boolean;
}

/**
 * Takes the composer's place while a run is paused because its token budget ran out, like an
 * ask_user question: the user adds budget to continue, or stops the task. The run takes no
 * messages until it resumes, so the composer stays hidden until then.
 */
export function AgentBudgetPauseOverlay({
    client,
    agentRunId,
    pause,
    onStop,
    disabled = false,
    onBudgetRequest,
    renderBudgetRequest,
}: AgentBudgetPauseOverlayProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<unknown>();
    const allocationPending = useRef(false);
    const callbackInvoked = useRef(false);
    const active = useRef(false);
    const dollarExhausted =
        pause.limitUsd !== undefined && (pause.reportedUsd ?? 0) + (pause.estimatedUsd ?? 0) >= pause.limitUsd;
    const suggestedUsd = Math.max(1, Math.ceil((pause.limitUsd ?? 0) / 2));
    const suggested = dollarExhausted ? suggestedUsd : suggestedBudgetAllocation(pause);
    const overridden = Boolean(onBudgetRequest || renderBudgetRequest);

    useEffect(() => {
        active.current = !disabled;
        return () => {
            active.current = false;
        };
    }, [disabled]);

    const allocate = useCallback(
        async (amount: number, currency: 'tokens' | 'usd' = 'tokens') => {
            if (disabled || !active.current || allocationPending.current) return false;
            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                (currency === 'tokens'
                    ? !Number.isSafeInteger(amount)
                    : !Number.isSafeInteger(Math.round(amount * 1e9)))
            ) {
                setError(
                    new RangeError(
                        currency === 'usd' ? t('agent.budgetPause.usdHelp') : t('agent.budgetPause.invalidAmount'),
                    ),
                );
                return false;
            }
            allocationPending.current = true;
            setError(undefined);
            setIsSubmitting(true);
            try {
                await client.agents.allocateBudget(
                    agentRunId,
                    currency === 'usd' ? { additional_usd: amount } : { additional_tokens: amount },
                );
                // Keep the action locked until the allocation status removes this pause.
                return true;
            } catch (error: unknown) {
                allocationPending.current = false;
                setIsSubmitting(false);
                setError(error);
                if (!overridden) {
                    console.error('Failed to add token budget', error);
                    toast({
                        status: 'error',
                        title: t('agent.budgetPause.allocateFailed'),
                        description: error instanceof Error ? error.message : t('agent.unknownError'),
                        duration: 4000,
                    });
                }
                return false;
            }
        },
        [agentRunId, client, disabled, overridden, t, toast],
    );

    const request = useMemo<AgentBudgetRequestContext>(
        () => ({
            agentRunId,
            pause,
            suggestedTokens: suggestedBudgetAllocation(pause),
            ...(pause.limitUsd !== undefined && {
                suggestedUsd,
                allocateUsd: (amount: number) => allocate(amount, 'usd'),
            }),
            allocateBudget: allocate,
            stop: disabled ? undefined : onStop,
            disabled,
            isSubmitting,
            error,
        }),
        [agentRunId, pause, suggestedUsd, allocate, disabled, onStop, isSubmitting, error],
    );

    useEffect(() => {
        if (!onBudgetRequest || disabled || callbackInvoked.current) return;
        callbackInvoked.current = true;
        // Invoke outside render and catch both synchronous throws and rejected promises.
        void Promise.resolve()
            .then(() => {
                if (active.current) return onBudgetRequest(request);
            })
            .catch((cause: unknown) => {
                if (active.current) setError(cause);
            });
    }, [disabled, onBudgetRequest, request]);

    if (overridden) return renderBudgetRequest?.(request) ?? null;

    const handleCustomAmount = (value: string) => {
        const amount =
            dollarExhausted && /^\d+(?:\.\d{1,9})?$/.test(value.trim()) ? Number(value) : parseBudgetAmount(value);
        if (amount === undefined) {
            toast({
                status: 'warning',
                title: dollarExhausted ? t('agent.budgetPause.usdHelp') : t('agent.budgetPause.invalidAmount'),
                duration: 4000,
            });
            return;
        }
        void allocate(amount, dollarExhausted ? 'usd' : 'tokens');
    };

    const used = pause.usedUnits !== undefined ? Math.round(pause.usedUnits).toLocaleString() : undefined;
    const limit = pause.limitTokens !== undefined ? Math.round(pause.limitTokens).toLocaleString() : undefined;
    const description = dollarExhausted
        ? t('agent.budgetPause.usdUsage', {
              reported: (pause.reportedUsd ?? 0).toFixed(4),
              estimated: (pause.estimatedUsd ?? 0).toFixed(4),
              limit: pause.limitUsd,
          })
        : used && limit
          ? t('agent.budgetPause.descriptionWithUsage', { used, limit })
          : t('agent.budgetPause.description');

    const options: AskUserOption[] = [
        {
            id: ALLOCATE_OPTION,
            label: dollarExhausted
                ? t('agent.budgetPause.usdAdd', { amount: suggested })
                : t('agent.budgetPause.addOption', { amount: suggested.toLocaleString() }),
            description: dollarExhausted ? t('agent.budgetPause.usdHelp') : t('agent.budgetPause.amountHelp'),
        },
        ...(onStop ? [{ id: STOP_OPTION, label: t('agent.budgetPause.stop') }] : []),
    ];

    return (
        <ComposerOverlay data-agent-budget-pause-overlay>
            <ComposerOverlayQuestion
                question={`**${dollarExhausted ? t('agent.budgetPause.usdTitle') : t('agent.budgetPause.title')}**\n\n${description}`}
                options={options}
                onSelect={(optionId) => {
                    if (optionId === STOP_OPTION) onStop?.();
                    else void allocate(suggested, dollarExhausted ? 'usd' : 'tokens');
                }}
                allowFreeResponse
                placeholder={
                    dollarExhausted
                        ? t('agent.budgetPause.usdPlaceholder')
                        : t('agent.budgetPause.customAmountPlaceholder')
                }
                submitLabel={t('agent.budgetPause.customAmountSubmit')}
                onSubmit={handleCustomAmount}
                icon={<AlertTriangle className="size-4" />}
                isLoading={disabled || isSubmitting}
            />
        </ComposerOverlay>
    );
}
