import { type ErrorFallbackComponentProps, VertesiaErrorBoundary } from './VertesiaErrorBoundary';
import type { ReactNode } from 'react';

export function WidgetErrorBoundary({ children }: { children: ReactNode }) {
    return <VertesiaErrorBoundary fallback={WidgetErrorFallback}>{children}</VertesiaErrorBoundary>;
}

function WidgetErrorFallback({ error }: ErrorFallbackComponentProps) {
    const message = error instanceof Error ? error.message : undefined;

    console.log('WidgetError', error);

    return (
        <div className="text-sm">
            Sorry, this area cannot be loaded or rendered.
            {message && <pre>{message}</pre>}
        </div>
    );
}
