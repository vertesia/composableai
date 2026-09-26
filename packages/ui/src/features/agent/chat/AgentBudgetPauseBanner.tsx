import type { VertesiaClient } from '@vertesia/client';
import { Button, FormItem, MessageBox, NumberInput, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useState } from 'react';
import { type BudgetPause, suggestedBudgetAllocation } from './budgetPause';

interface AgentBudgetPauseBannerProps {
    client: VertesiaClient;
    agentRunId: string;
    pause: BudgetPause;
    /** Ends the paused task; absent when the viewer cannot control the run. */
    onStop?: () => void;
    disabled?: boolean;
}

/**
 * Shown while a run is paused because its token budget ran out: the user adds an explicit amount
 * to continue, or stops the task. Messages typed meanwhile are queued until the run resumes.
 */
export function AgentBudgetPauseBanner({ client, agentRunId, pause, onStop, disabled }: AgentBudgetPauseBannerProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [amount, setAmount] = useState<number | undefined>(() => suggestedBudgetAllocation(pause));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const valid = amount !== undefined && Number.isInteger(amount) && amount > 0;

    const handleAllocate = async () => {
        if (!valid || isSubmitting) return;
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

    const used = pause.usedUnits !== undefined ? Math.round(pause.usedUnits).toLocaleString() : undefined;
    const limit = pause.limitTokens !== undefined ? Math.round(pause.limitTokens).toLocaleString() : undefined;

    return (
        <MessageBox status="warning" title={t('agent.budgetPause.title')} className="m-2">
            <div className="flex flex-col gap-3">
                <p>
                    {used && limit
                        ? t('agent.budgetPause.descriptionWithUsage', { used, limit })
                        : t('agent.budgetPause.description')}
                </p>
                <div className="flex flex-wrap items-end gap-2">
                    <FormItem label={t('agent.budgetPause.amountLabel')} helpText={t('agent.budgetPause.amountHelp')}>
                        <NumberInput
                            value={amount}
                            onChange={(value) => setAmount(value)}
                            min={1}
                            step={10_000}
                            className="w-48"
                            disabled={disabled || isSubmitting}
                        />
                    </FormItem>
                    <Button onClick={() => void handleAllocate()} disabled={disabled || isSubmitting || !valid}>
                        {t('agent.budgetPause.continue')}
                    </Button>
                    {onStop && (
                        <Button variant="outline" onClick={onStop} disabled={disabled || isSubmitting}>
                            {t('agent.budgetPause.stop')}
                        </Button>
                    )}
                </div>
            </div>
        </MessageBox>
    );
}
