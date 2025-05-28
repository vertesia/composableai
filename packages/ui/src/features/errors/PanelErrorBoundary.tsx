import { MessageBox } from '@vertesia/ui/core';
import { VertesiaErrorBoundary } from '@vertesia/ui/features/errors/VertesiaErrorBoundary';
import { ReactNode } from 'react';

export function PanelErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <VertesiaErrorBoundary fallback={PanelErrorFallback}>
            {children}
        </VertesiaErrorBoundary>
    );
}

function PanelErrorFallback({ error }: { error?: Error }) {
    return (
        <MessageBox status="error" title="Sorry, something went wrong...">
            <div className='mb-4'>
                Our team has been notified and will be quickly working on resolving it.
                If you&apos;d like to escalate or simply contact us, please email us at&nbsp;

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
