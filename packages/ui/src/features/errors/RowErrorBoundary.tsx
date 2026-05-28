import { type ErrorFallbackComponentProps, VertesiaErrorBoundary } from './VertesiaErrorBoundary';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export function RowErrorBoundary({ children }: ErrorBoundaryProps) {
    return <VertesiaErrorBoundary fallback={RowErrorFallback}>{children}</VertesiaErrorBoundary>;
}

function RowErrorFallback({ error }: ErrorFallbackComponentProps) {
    const message = error instanceof Error ? error.message : undefined;
    return (
        <tr>
            <td colSpan={100}>
                <span className="text-xs"> Cannot display row</span>
                <br />
                <span className="bg-gray-400">{message}</span>
            </td>
        </tr>
    );
}
