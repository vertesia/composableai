import { Button, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { LockKeyhole, LockOpen } from 'lucide-react';

export interface DocumentEditingLockStatusProps {
    isLocked: boolean;
    onToggleLock: () => void;
}

/** Compact turn-level lock status for the full-document editor toolbar. */
export function DocumentEditingLockStatus({ isLocked, onToggleLock }: DocumentEditingLockStatusProps) {
    const { t } = useUITranslation();
    const title = isLocked ? t('agent.editingLockedTitle') : t('agent.editingManuallyUnlockedTitle');
    const description = isLocked ? t('agent.editingLockedDescription') : t('agent.editingManuallyUnlockedDescription');
    const action = isLocked ? t('agent.unlockEditing') : t('agent.lockEditing');

    return (
        <div
            className="flex h-8 max-w-64 shrink-0 items-center gap-1 rounded-md border border-mixer-attention/30 bg-mixer-attention/10 ps-2 pe-1 text-attention"
            role={isLocked ? 'status' : 'alert'}
            aria-live="polite"
        >
            {isLocked ? (
                <LockKeyhole className="size-3.5 shrink-0 animate-pulse" />
            ) : (
                <LockOpen className="size-3.5 shrink-0" />
            )}
            <VTooltip description={description} asChild>
                <span className="min-w-0 truncate text-xs font-medium text-foreground">{title}</span>
            </VTooltip>
            <span className="sr-only">{description}</span>
            <VTooltip description={action} asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="size-6 shrink-0 rounded p-0 text-attention hover:bg-mixer-attention/15"
                    onClick={onToggleLock}
                    aria-label={action}
                >
                    {isLocked ? <LockOpen className="size-3.5" /> : <LockKeyhole className="size-3.5" />}
                </Button>
            </VTooltip>
        </div>
    );
}
