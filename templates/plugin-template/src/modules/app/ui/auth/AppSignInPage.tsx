import { Env } from '@vertesia/ui/env';
import type { SignInScreenViewProps } from '@vertesia/ui/shell';
import { AppAuthLoadingPage } from './AppAuthLoadingPage';

/** Own the whole login page here. Keep children for the shared forms, or render from flow. */
export function AppSignInPage({ children, notice, flow, authError }: SignInScreenViewProps) {
    if (flow.mode === 'pending' && !authError) return <AppAuthLoadingPage />;

    return (
        <main className="min-h-dvh bg-background px-6 py-12 text-foreground">
            <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8">
                <h1 className="text-2xl font-semibold">{Env.name}</h1>
                {children}
                {notice}
            </div>
        </main>
    );
}
