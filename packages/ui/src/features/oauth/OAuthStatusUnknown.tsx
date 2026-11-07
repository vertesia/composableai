import { useUITranslation } from '@vertesia/ui/i18n';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../../core/index.js';

interface OAuthStatusUnknownProps {
    /** Checks the status again. Without it (read-only views) the state is shown as plain text. */
    onRetry?: () => void;
    compact?: boolean;
    className?: string;
}

/** Shown instead of a connected or disconnected state when the status check got no answer. */
export function OAuthStatusUnknown({ onRetry, compact = false, className }: OAuthStatusUnknownProps) {
    const { t } = useUITranslation();
    const iconClassName = compact ? 'size-3' : 'size-4';

    if (!onRetry) {
        return (
            <span
                className={`inline-flex items-center gap-1 text-attention ${compact ? 'text-xs' : 'text-sm'}`}
                title={t('oauthStatus.unknownHint')}
            >
                <TriangleAlert className={iconClassName} aria-hidden="true" />
                <span>{t('oauthStatus.unknown')}</span>
            </span>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className={className}
            aria-label={t('oauthStatus.retry')}
            title={t('oauthStatus.unknownHint')}
        >
            <RefreshCw className={iconClassName} aria-hidden="true" />
            <span>{t('oauthStatus.unknown')}</span>
        </Button>
    );
}
