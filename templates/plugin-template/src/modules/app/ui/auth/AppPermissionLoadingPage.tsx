import { Button, Spinner } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import type { PermissionLoadingScreenProps } from '@vertesia/ui/features';

/** The session is authenticated; permissions are still loading or need recovery. */
export function AppPermissionLoadingPage({
    status,
    title,
    description,
    loadingIcon,
    actionLabel,
    onAction,
}: PermissionLoadingScreenProps) {
    const failed = status === 'error';
    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
            <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
                <h1 className="text-2xl font-semibold">{Env.name}</h1>
                {!failed && <div aria-hidden="true">{loadingIcon ?? <Spinner size="2xl" />}</div>}
                <div role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'}>
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <p className="mt-2 text-muted">{description}</p>
                </div>
                {failed && (
                    <Button variant="outline" onClick={onAction}>
                        {actionLabel}
                    </Button>
                )}
            </div>
        </main>
    );
}
