/**
 * The sign-in state machine, extracted from SigninScreen so more than one host can drive it.
 *
 * Two hosts run it today: the Studio shell, which layers its own error-recovery modes on top
 * (`SigninScreen`), and the Central Auth broker, which has no Vertesia session and renders only the
 * modes below. The interesting behaviour is not the markup — it is the ordering: remembered
 * identity first, then email, then tenant resolution deciding which providers are even offered.
 * Re-implementing that per host is how the two pages drift apart.
 *
 * The hook takes no session dependency of its own: `signOut` and `trackEvent` come in as options
 * because a host without a `UserSessionProvider` cannot call those hooks.
 */
import { useCallback, useEffect, useState } from 'react';
import SignInAuthPending from './SignInAuthPending';
import SignInEmailStep, { type TenantInfo } from './SignInEmailStep';
import SignInProvidersStep from './SignInProvidersStep';
import SignInReturningStep from './SignInReturningStep';
import SignInTenantStep from './SignInTenantStep';
import {
    clearLastSuccessfulLogin,
    clearPendingSignin,
    finalizeSuccessfulLogin,
    type LastSuccessfulLogin,
    type ProviderId,
    readLastSuccessfulLogin,
    resetSignInState,
    signOutOfFirebase,
} from './signInUtils';

/** The modes every host shares. Hosts may add their own; see the `M` parameter below. */
export type SignInCoreMode = 'email' | 'providers' | 'tenant' | 'returning' | 'pending';

export interface SignInFlowOptions {
    /**
     * Host sign-out, run when the user abandons the remembered identity. Defaults to a plain
     * Firebase sign-out; a host with a Vertesia session passes its own so the session goes too.
     */
    signOut?: () => void | Promise<void>;
    /** Analytics sink. Only `enterprise_signin` is emitted, and only for a tenant-resolved sign-in. */
    trackEvent?: (eventName: string, eventProperties?: Record<string, unknown>) => void;
    /**
     * The authenticated user, once there is one. Supplying it lets the flow stamp the display name
     * onto the remembered-login record; a host that unmounts the flow on login should call
     * {@link finalizeSuccessfulLogin} itself instead.
     */
    user?: { name?: string | null } | null;
}

/**
 * Flow state plus the handlers the steps are wired to.
 *
 * `M` is the host's own extra modes: `SigninScreen` passes its error-recovery union so `mode` and
 * `setMode` stay exhaustively typed there, while a host with no extra modes gets `SignInCoreMode`.
 */
export interface SignInFlowController<M extends string = never> {
    mode: SignInCoreMode | M;
    setMode: (mode: SignInCoreMode | M) => void;
    email: string;
    setEmail: (email: string) => void;
    tenant: TenantInfo | undefined;
    setTenant: (tenant: TenantInfo | undefined) => void;
    storedSession: LastSuccessfulLogin | null;
    setStoredSession: (session: LastSuccessfulLogin | null) => void;
    pendingProvider: ProviderId | null;
    /** Email accepted: go to the tenant step when one resolved, otherwise the provider list. */
    onProceedFromEmail: (email: string, tenant?: TenantInfo) => void;
    /** Back to the email step, dropping the resolved tenant. */
    onBack: () => void;
    /** "Not you?" — forget the remembered identity and sign out. */
    onNotYou: () => void;
    /** A provider was picked; show the pending screen while the IdP redirect happens. */
    onProviderClicked: (provider: ProviderId) => void;
    /** Full reset: clear the persisted records and the Firebase session, back to the email step. */
    startOver: () => void;
}

export function useSignInFlow<M extends string = never>(options: SignInFlowOptions = {}): SignInFlowController<M> {
    const { signOut, trackEvent, user } = options;

    const [storedSession, setStoredSession] = useState<LastSuccessfulLogin | null>(() => readLastSuccessfulLogin());
    const [mode, setMode] = useState<SignInCoreMode | M>(() => (readLastSuccessfulLogin() ? 'returning' : 'email'));
    const [email, setEmail] = useState('');
    const [tenant, setTenant] = useState<TenantInfo | undefined>(undefined);
    const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);

    // On successful login, finalize the last-successful-login entry with the user's name.
    useEffect(() => {
        if (!user) return;
        finalizeSuccessfulLogin(user.name ?? undefined);
    }, [user]);

    const onProceedFromEmail = useCallback((e: string, t: TenantInfo | undefined) => {
        setEmail(e);
        setTenant(t);
        setMode(t ? 'tenant' : 'providers');
    }, []);

    const onBack = useCallback(() => {
        setMode('email');
        setTenant(undefined);
    }, []);

    const onNotYou = useCallback(() => {
        clearLastSuccessfulLogin();
        clearPendingSignin();
        setStoredSession(null);
        setEmail('');
        setTenant(undefined);
        setMode('email');
        // Without a host sign-out, drop the Firebase session anyway: leaving it behind means the
        // next auth-state change re-authenticates the identity the user just said isn't theirs.
        void (signOut ? signOut() : signOutOfFirebase());
    }, [signOut]);

    const onProviderClicked = useCallback(
        (provider: ProviderId) => {
            // Tenant context comes from a resolved tenant or stored tenantName, not the provider.
            const hasTenant = !!tenant || !!storedSession?.tenantName;
            // Only the pre-existing enterprise_signin event; non-tenant sign-ins emit nothing.
            if (hasTenant) trackEvent?.('enterprise_signin', { provider });
            setPendingProvider(provider);
            setMode('pending');
            // The redirect itself happens in the calling step's startSignIn(); this just shows the pending screen.
        },
        [trackEvent, storedSession?.tenantName, tenant],
    );

    const startOver = useCallback(() => {
        setStoredSession(null); // drop the in-memory mirror too — resetSignInState only clears storage
        setEmail('');
        setTenant(undefined);
        setMode('email');
        void resetSignInState();
    }, []);

    return {
        mode,
        setMode,
        email,
        setEmail,
        tenant,
        setTenant,
        storedSession,
        setStoredSession,
        pendingProvider,
        onProceedFromEmail,
        onBack,
        onNotYou,
        onProviderClicked,
        startOver,
    };
}

/**
 * The part of the controller the shared steps read.
 *
 * Deliberately excludes the setters: their parameter types mention the host's extra modes, and a
 * contravariant position would stop `SignInFlowController<never>` from being passed here.
 */
export type SignInStepsController = Omit<
    SignInFlowController<string>,
    'setMode' | 'setEmail' | 'setTenant' | 'setStoredSession' | 'startOver'
>;

interface SignInFlowStepsProps {
    flow: SignInStepsController;
    /** Path to return to after the IdP round-trip. Defaults to the current pathname. */
    redirectTo?: string;
}

/**
 * Renders the step for the current core mode. A host mode this doesn't know falls through to the
 * email step, which is where the original screen sent an unrecognized state too.
 */
export function SignInFlowSteps({ flow, redirectTo }: SignInFlowStepsProps) {
    const { mode, email, tenant, storedSession, pendingProvider } = flow;

    if (mode === 'pending' && pendingProvider) {
        return <SignInAuthPending provider={pendingProvider} />;
    }
    if (mode === 'tenant' && tenant) {
        return (
            <SignInTenantStep
                email={email}
                tenant={tenant}
                onBack={flow.onBack}
                onProviderClicked={() => flow.onProviderClicked((tenant.provider ?? 'oidc') as ProviderId)}
                redirectTo={redirectTo}
            />
        );
    }
    if (mode === 'providers') {
        return (
            <SignInProvidersStep
                email={email}
                onBack={flow.onBack}
                onProviderClicked={flow.onProviderClicked}
                redirectTo={redirectTo}
            />
        );
    }
    if (mode === 'returning' && storedSession) {
        return (
            <SignInReturningStep
                session={storedSession}
                onNotYou={flow.onNotYou}
                onProviderClicked={flow.onProviderClicked}
                redirectTo={redirectTo}
            />
        );
    }
    return <SignInEmailStep initialEmail={email} onProceed={flow.onProceedFromEmail} />;
}
