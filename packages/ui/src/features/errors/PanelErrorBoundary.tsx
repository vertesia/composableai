import { MessageBox } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { ReactNode } from 'react';
import { type ErrorFallbackComponentProps, VertesiaErrorBoundary } from './VertesiaErrorBoundary';

export function PanelErrorBoundary({ children }: { children: ReactNode }) {
    return <VertesiaErrorBoundary fallback={PanelErrorFallback}>{children}</VertesiaErrorBoundary>;
}

function PanelErrorFallback({ error }: ErrorFallbackComponentProps) {
    const { t } = useUITranslation();
    const message = error instanceof Error ? error.message : undefined;
    return (
        <MessageBox status="error" title={t('errors.somethingWentWrong')}>
            <div className="mb-4">
                {t('errors.teamNotifiedLine1')} {t('errors.teamNotifiedLine2')}&nbsp;
                <a className="text-info" href="mailto:support@vertesiahq.com">
                    support@vertesiahq.com
                </a>
                .
            </div>

            {message && <code className="w-full mt-4 text-sm text-muted break-words">{message}</code>}
        </MessageBox>
    );
}
