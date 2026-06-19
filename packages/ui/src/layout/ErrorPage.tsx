import { Button } from '@vertesia/ui/core';

type ErrorPageProps = {
    title?: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
};

export function ErrorPage({
    title = 'Something went wrong',
    message = 'An unexpected error occurred. Please try again.',
    actionLabel = 'Try again',
    onAction,
}: ErrorPageProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-center">
            <div className="max-w-md space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-3xl font-semibold text-destructive">
                    !
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                    <p className="text-sm leading-6 text-muted">{message}</p>
                </div>

                {onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
            </div>
        </div>
    );
}
