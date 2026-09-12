import { Spinner } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { AuthLoadingScreenProps } from '@vertesia/ui/shell';

/** Authentication initialization and the return from an identity-provider redirect. */
export function AppAuthLoadingPage({ loadingIcon }: AuthLoadingScreenProps) {
    const { t } = useUITranslation();
    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
            <div className="flex flex-col items-center gap-6 text-center" role="status" aria-live="polite">
                <h1 className="text-2xl font-semibold">{Env.name}</h1>
                <div aria-hidden="true">{loadingIcon ?? <Spinner size="2xl" />}</div>
                <p className="text-muted">{t('auth.pending.authenticating')}</p>
            </div>
        </main>
    );
}
