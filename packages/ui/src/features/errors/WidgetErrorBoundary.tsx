import { VertesiaErrorBoundary } from './VertesiaErrorBoundary';
import { ReactNode } from 'react';

export function WidgetErrorBoundary({ children }: { children: ReactNode }) {

    return (
        <VertesiaErrorBoundary fallback={WidgetErrorFallback}>
            {children}
        </VertesiaErrorBoundary>
    )
}

function WidgetErrorFallback({ error }: { error?: Error }) {

    console.log('WidgetError', error);

    return (
        <div className="text-sm">
            Sorry, this area cannot be loaded or rendered.
            {error?.message &&
                <pre>
                    {error.message}
                </pre>
            }
        </div>
    )
}