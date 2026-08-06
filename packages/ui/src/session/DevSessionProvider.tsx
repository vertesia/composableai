import type { AuthTokenPayload } from '@vertesia/common';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from './constants';
import { UserSession, UserSessionContext } from './UserSession';

function decodeJwtPayload(token: string): AuthTokenPayload {
    const [, payload] = token.split('.');
    if (!payload) {
        throw new Error('Invalid Vertesia auth token');
    }
    const padded = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as AuthTokenPayload;
}

interface DevSessionProviderProps {
    children: ReactNode;
    token: string;
}

export function DevSessionProvider({ children, token }: DevSessionProviderProps) {
    const session = useMemo(() => {
        const next = new UserSession();
        next.isLoading = false;

        try {
            next.authToken = decodeJwtPayload(token);
            next.client.withAuthCallback(() => Promise.resolve(`Bearer ${token}`));

            localStorage.setItem(LastSelectedAccountId_KEY, next.authToken.account.id);
            localStorage.setItem(
                `${LastSelectedProjectId_KEY}-${next.authToken.account.id}`,
                next.authToken.project?.id ?? '',
            );
        } catch (error: unknown) {
            next.authError = error instanceof Error ? error : new Error(String(error));
        }

        return next.clone();
    }, [token]);

    return <UserSessionContext.Provider value={session}>{children}</UserSessionContext.Provider>;
}
