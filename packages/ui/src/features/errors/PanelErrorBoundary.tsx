import { MessageBox } from '@vertesia/ui/core';
import { VertesiaErrorBoundary } from './VertesiaErrorBoundary';
import { ReactNode } from 'react';
import { useUITranslation } from '../../i18n/index.js';

export function PanelErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <VertesiaErrorBoundary fallback={PanelErrorFallback}>
            {children}
        </VertesiaErrorBoundary>
    );
}

function PanelErrorFallback({ error }: { error?: Error }) {
    const { t } = useUITranslation();
    return (
        <MessageBox status="error" title={t('errors.somethingWentWrong')}>
            <div className='mb-4'>
                {t('errors.teamNotifiedLine1')}
                {' '}{t('errors.teamNotifiedLine2')}&nbsp;

                <a className='text-info' href="mailto:support@vertesiahq.com">support@vertesiahq.com</a>.
            </div>

            {error?.message &&
                <code className='w-full mt-4 text-sm text-muted break-words'>
                    {error.message}
                </code>
            }
        </MessageBox>
    );
}
