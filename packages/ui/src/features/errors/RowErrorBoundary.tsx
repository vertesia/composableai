import { VertesiaErrorBoundary } from "@vertesia/ui/features/errors/VertesiaErrorBoundary";
import { ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export function RowErrorBoundary({ children }: ErrorBoundaryProps) {

    return (
        <VertesiaErrorBoundary fallback={RowErrorFallback}>
            {children}
        </VertesiaErrorBoundary>
    )
}

function RowErrorFallback({ error }: { error?: Error }) {
    return (
        <tr>
            <td colSpan={100}>
                <span className="text-xs"> Cannot display row</span>
                <br />
                <span className="bg-gray-400">{error?.message}</span>
            </td>
        </tr>
    )
}