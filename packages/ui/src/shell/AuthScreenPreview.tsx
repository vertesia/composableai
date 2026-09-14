/** Developer-only visual fixtures. Mount outside the authenticated application tree. */
import { I18nProvider, useUITranslation } from '@vertesia/ui/i18n';
import type { ReactNode } from 'react';
import type { AppBranding } from '../boot/branding.js';
import {
    AppBrandingProvider,
    BrandedAuthLoadingScreen,
    BrandedPermissionLoadingScreen,
    BrandedSignInScreen,
} from './BrandedAuthScreens';
import { type SignInFlowController, SignInFlowSteps } from './login/SignInFlow';
import SignInRecoveryStep, { type SignInRecoveryKind } from './login/SignInRecoveryStep';
import { SignInRestrictedEnvView } from './login/SignInRestrictedEnvStep';
import SignInTenantBlockedStep from './login/SignInTenantBlockedStep';
import { SignInErrorNotice, type SignInRecoveryMode } from './login/SigninScreen';
import SignupForm from './login/SignupForm';
import type { AuthScreens } from './VertesiaShell';

export const AUTH_PREVIEW_SCREENS = [
    'email',
    'providers',
    'tenant',
    'returning',
    'pending',
    'blocked',
    'signup',
    'restricted',
    'scope-project',
    'scope-account',
    'no-account',
    'credentials',
    'service',
    'auth-error',
    'loading',
    'permissions',
    'permission-retry',
    'permission-error',
    'permission-denied',
    'permission-session-expired',
    'boot',
] as const;
export type AuthPreviewScreen = (typeof AUTH_PREVIEW_SCREENS)[number];

const noop = () => {};
const identity = { email: 'alex@example.com', name: 'Alex Example' };
const signupIdentity = { email: identity.email, displayName: identity.name };
const recoveryKinds: Partial<Record<AuthPreviewScreen, SignInRecoveryKind>> = {
    'scope-project': 'scopeProject',
    'scope-account': 'scopeAccount',
    'no-account': 'noAccessibleAccount',
    credentials: 'credential',
    service: 'service',
};

export function AuthScreenPreview({
    screen,
    branding,
    screens = {},
}: {
    screen: string;
    branding: AppBranding;
    screens?: AuthScreens;
}) {
    const { t } = useUITranslation();
    const selected = AUTH_PREVIEW_SCREENS.find((value) => value === screen) ?? 'email';
    const SignIn = screens.SignIn ?? BrandedSignInScreen;
    const Loading = screens.Loading ?? BrandedAuthLoadingScreen;
    const Permissions = screens.Permissions ?? BrandedPermissionLoadingScreen;
    const recovery = recoveryKinds[selected];
    const flow: SignInFlowController<SignInRecoveryMode> = {
        mode:
            selected === 'providers' ||
            selected === 'tenant' ||
            selected === 'returning' ||
            selected === 'pending' ||
            selected === 'blocked' ||
            selected === 'signup' ||
            selected === 'restricted'
                ? selected
                : selected === 'scope-project' || selected === 'scope-account'
                  ? 'scopeUnavailable'
                  : selected === 'no-account'
                    ? 'noAccessibleAccount'
                    : selected === 'credentials'
                      ? 'credentialFailure'
                      : selected === 'service'
                        ? 'serviceFailure'
                        : 'email',
        email: identity.email,
        tenant: { firebaseTenantId: 'preview', name: branding.name, provider: 'oidc' },
        storedSession: { ...identity, lastProvider: 'oidc', tenantName: branding.name },
        pendingProvider: 'oidc',
        setMode: noop,
        setEmail: noop,
        setTenant: noop,
        setStoredSession: noop,
        onProceedFromEmail: noop,
        onBack: noop,
        onNotYou: noop,
        onProviderClicked: noop,
        startOver: noop,
    };
    let content: ReactNode = <SignInFlowSteps flow={flow} />;
    if (selected === 'blocked')
        content = <SignInTenantBlockedStep email={identity.email} tenantName={branding.name} onBack={noop} />;
    if (selected === 'restricted') content = <SignInRestrictedEnvView onUseDifferentEmail={noop} onRedirect={noop} />;
    if (selected === 'signup') content = <SignupForm identity={signupIdentity} onSignup={noop} goBack={noop} />;
    if (recovery)
        content = (
            <SignInRecoveryStep
                kind={recovery}
                identity={identity}
                details={{ message: 'Preview error details', status: 403 }}
                onContinue={
                    recovery === 'scopeProject' || recovery === 'scopeAccount' || recovery === 'service'
                        ? noop
                        : undefined
                }
                onUseDifferentAccount={noop}
            />
        );
    let page: ReactNode = (
        <SignIn
            flow={flow}
            isNested={false}
            notice={selected === 'auth-error' ? <SignInErrorNotice /> : null}
            onUseDifferentAccount={noop}
            onContinueWithSanitizedScope={noop}
            onRetry={noop}
            onSignup={noop}
        >
            {content}
        </SignIn>
    );
    if (selected === 'loading') page = <Loading />;
    if (
        selected === 'permissions' ||
        selected === 'permission-retry' ||
        selected === 'permission-error' ||
        selected === 'permission-denied' ||
        selected === 'permission-session-expired'
    ) {
        const denied = selected === 'permission-denied';
        const expired = selected === 'permission-session-expired';
        const failed = selected === 'permission-error' || denied || expired;
        page = (
            <Permissions
                status={failed ? 'error' : selected === 'permission-retry' ? 'retrying' : 'loading'}
                title={
                    expired
                        ? t('auth.recovery.credential.title')
                        : denied
                          ? t('shell.accessDenied')
                          : failed
                            ? t('permissions.connectionFailed')
                            : t('permissions.connecting')
                }
                description={
                    expired
                        ? t('auth.recovery.credential.body')
                        : denied
                          ? t('permissions.accessDenied')
                          : failed
                            ? t('permissions.tryAgainLater')
                            : selected === 'permission-retry'
                              ? t('permissions.retrying')
                              : t('permissions.loadingPermissions')
                }
                error={failed ? new Error('Preview permission error') : undefined}
                actionLabel={t(denied || expired ? 'auth.recovery.useDifferentAccount' : 'auth.recovery.tryAgain')}
                onAction={noop}
            />
        );
    }
    return (
        <I18nProvider>
            <AppBrandingProvider branding={branding}>
                {/* Inert fixtures cannot submit forms, redirect, or change the real session. */}
                <div inert style={{ display: 'contents' }}>
                    {page}
                </div>
                <details
                    className="fixed top-2 start-2 max-h-80 overflow-auto rounded border bg-background text-foreground p-3 text-sm"
                    style={{ zIndex: 2147483647 }}
                >
                    <summary>Auth preview: {selected}</summary>
                    <nav aria-label="Auth preview screens" className="flex flex-col gap-1 mt-2">
                        {AUTH_PREVIEW_SCREENS.map((value) => {
                            const params = new URLSearchParams(window.location.search);
                            params.delete('__vertesia_boot');
                            params.delete('__vertesia_auth');
                            params.set(
                                value === 'boot' ? '__vertesia_boot' : '__vertesia_auth',
                                value === 'boot' ? 'slow' : value,
                            );
                            return (
                                <a
                                    key={value}
                                    href={`?${params}`}
                                    aria-current={value === selected ? 'page' : undefined}
                                >
                                    {value}
                                </a>
                            );
                        })}
                        <a href={window.location.pathname}>Exit preview</a>
                    </nav>
                </details>
            </AppBrandingProvider>
        </I18nProvider>
    );
}

/** Hosts call this only from their import.meta.env.DEV branch, before mounting auth/session providers. */
export async function mountAuthScreenPreview(
    container: HTMLElement,
    screen: string,
    branding: AppBranding = {
        name: 'Vertesia',
        logo: { light: '/logo-light.png', dark: '/logo-dark.png' },
        loadingIcon: { light: '/icon.svg' },
    },
    screens: AuthScreens = {},
): Promise<void> {
    if (screen === 'boot') return;
    const { createRoot } = await import('react-dom/client');
    createRoot(container).render(<AuthScreenPreview screen={screen} branding={branding} screens={screens} />);
}
