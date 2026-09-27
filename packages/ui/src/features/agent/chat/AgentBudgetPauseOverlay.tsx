import type { VertesiaClient } from '@vertesia/client';
import { useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { REQUEST_INPUT_OVERLAY_CLASS } from './AgentRequestInputOverlay';
import { type AskUserOption, AskUserWidget } from './AskUserWidget';
import { type BudgetPause, parseBudgetAmount, suggestedBudgetAllocation } from './budgetPause';

const ALLOCATE_OPTION = 'allocate';
const STOP_OPTION = 'stop';

interface AgentBudgetPauseOverlayProps {
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
export function AgentBudgetPauseOverlay({ client, agentRunId, pause, onStop, disabled }: AgentBudgetPauseOverlayProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const suggested = suggestedBudgetAllocation(pause);

    const allocate = async (amount: number) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await client.agents.allocateBudget(agentRunId, { additional_tokens: amount });
        } catch (error: unknown) {
            console.error('Failed to add token budget', error);
            toast({
                status: 'error',
                title: t('agent.budgetPause.allocateFailed'),
                description: error instanceof Error ? error.message : t('agent.unknownError'),
                duration: 4000,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCustomAmount = (value: string) => {
        const amount = parseBudgetAmount(value);
        if (amount === undefined) {
            toast({ status: 'warning', title: t('agent.budgetPause.invalidAmount'), duration: 4000 });
            return;
        }
        void allocate(amount);
    };

    const used = pause.usedUnits !== undefined ? Math.round(pause.usedUnits).toLocaleString() : undefined;
    const limit = pause.limitTokens !== undefined ? Math.round(pause.limitTokens).toLocaleString() : undefined;
    const description =
        used && limit
            ? t('agent.budgetPause.descriptionWithUsage', { used, limit })
            : t('agent.budgetPause.description');

    const options: AskUserOption[] = [
        {
            id: ALLOCATE_OPTION,
            label: t('agent.budgetPause.addOption', { amount: suggested.toLocaleString() }),
            description: t('agent.budgetPause.amountHelp'),
        },
        ...(onStop ? [{ id: STOP_OPTION, label: t('agent.budgetPause.stop') }] : []),
    ];

    return (
        <div className={REQUEST_INPUT_OVERLAY_CLASS} data-agent-budget-pause-overlay>
            <div className="mx-auto w-full max-w-3xl px-3 py-3">
                <AskUserWidget
                    question={`**${t('agent.budgetPause.title')}**\n\n${description}`}
                    options={options}
                    onSelect={(optionId) => {
                        if (optionId === STOP_OPTION) onStop?.();
                        else void allocate(suggested);
                    }}
                    allowFreeResponse
                    placeholder={t('agent.budgetPause.customAmountPlaceholder')}
                    submitLabel={t('agent.budgetPause.customAmountSubmit')}
                    onSubmit={handleCustomAmount}
                    icon={<AlertTriangle className="size-4" />}
                    hideBorder
                    compact
                    isLoading={disabled || isSubmitting}
                    className="my-0"
                    cardClassName="bg-background/80 shadow-lg shadow-black/5 dark:shadow-none"
                />
            </div>
        </div>
    );
}
