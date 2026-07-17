import { Button } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { LockKeyhole, LockOpen } from 'lucide-react';

export interface DocumentEditingLockBannerProps {
    isLocked: boolean;
    onToggleLock: () => void;
}

/** Persistent turn-level lock status with a manual recovery control. */
export function DocumentEditingLockBanner({ isLocked, onToggleLock }: DocumentEditingLockBannerProps) {
    const { t } = useUITranslation();

    return (
        <div
            className="flex shrink-0 items-center justify-between gap-4 border-b border-mixer-attention/30 bg-mixer-attention/10 px-4 py-2"
            role={isLocked ? 'status' : 'alert'}
            aria-live="polite"
        >
            <div className="flex min-w-0 items-center gap-2.5">
                {isLocked ? (
                    <LockKeyhole className="size-4 shrink-0 animate-pulse text-attention" />
                ) : (
                    <LockOpen className="size-4 shrink-0 text-attention" />
                )}
                <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                        {isLocked ? t('agent.editingLockedTitle') : t('agent.editingManuallyUnlockedTitle')}
                    </div>
                    <div className="truncate text-xs text-muted">
                        {isLocked ? t('agent.editingLockedDescription') : t('agent.editingManuallyUnlockedDescription')}
                    </div>
                </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onToggleLock}>
                {isLocked ? <LockOpen className="size-3.5" /> : <LockKeyhole className="size-3.5" />}
                {isLocked ? t('agent.unlockEditing') : t('agent.lockEditing')}
            </Button>
        </div>
    );
}
