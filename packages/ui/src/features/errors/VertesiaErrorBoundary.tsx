import { ReactNode, ComponentType } from "react"
import { ErrorBoundary } from "react-error-boundary";

export interface ErrorFallbackComponentProps {
    error: any;
    resetErrorBoundary: (...args: any[]) => void;
}
export type ErrorBoundaryProps = {
    children: ReactNode;
    fallback: ComponentType<ErrorFallbackComponentProps>;
};

export function VertesiaErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
    if (ErrorBoundaryInstance) { // custom error boundary?
        return <ErrorBoundaryInstance fallback={fallback}>{children}</ErrorBoundaryInstance>
    } else {
        return <ErrorBoundary FallbackComponent={fallback}>{children}</ErrorBoundary>
    }
}

let ErrorBoundaryInstance: ComponentType<{
    fallback: ComponentType<ErrorFallbackComponentProps>;
    children: ReactNode;
}> | null = null;

export function setErrorBoundaryComponent(ErrorBoundaryComponent: ComponentType<ErrorBoundaryProps>) {
    ErrorBoundaryInstance = ErrorBoundaryComponent;
}
