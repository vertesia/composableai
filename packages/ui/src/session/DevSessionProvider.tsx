import { decodeJWT } from '@vertesia/client';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { rememberScopeSelection } from './scopeSelection';
import { UserSession, UserSessionContext } from './UserSession';

interface DevSessionProviderProps {
    children: ReactNode;
    token: string;
}

export function DevSessionProvider({ children, token }: DevSessionProviderProps) {
    const session = useMemo(() => {
        const next = new UserSession();
        next.isLoading = false;

        try {
            next.authToken = decodeJWT(token);
            next.client.withAuthCallback(() => Promise.resolve(`Bearer ${token}`));

            rememberScopeSelection(next.authToken.account.id, next.authToken.project?.id);
        } catch (error: unknown) {
            next.authError = error instanceof Error ? error : new Error(String(error));
        }

        return next.clone();
    }, [token]);

    return <UserSessionContext.Provider value={session}>{children}</UserSessionContext.Provider>;
}
