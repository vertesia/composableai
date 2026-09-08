import type { VertesiaClient } from '@vertesia/client';
import type { AuthTokenPayload, SystemRoleDefinition } from '@vertesia/common';
import { useCallback, useEffect, useMemo, useState } from 'react';

type RoleMappingsState =
    | { status: 'loading' | 'retrying' }
    | { status: 'ready'; roles: SystemRoleDefinition[] }
    | { status: 'error'; error?: unknown };

export function roleMappingsErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
        return error.status;
    }
    return undefined;
}

function isTransient(error: unknown): boolean {
    const status = roleMappingsErrorStatus(error);
    return (
        status === 0 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        (error instanceof Error && error.name === 'TimeoutError')
    );
}

/** Each session gets an independent, cancellable recovery window. Never reuse another session's roles. */
export function useRoleMappings(client: VertesiaClient, authToken?: AuthTokenPayload) {
    // UserSession.rawAuthToken decodes the cached JWT on each authenticated request.
    // Object identity would restart recovery on every failure (or success), forever.
    // Preserve all claims in the identity: subject/account/expiry can stay the same
    // when project, roles, or other authorization claims change.
    const tokenKey = useMemo(() => (authToken ? JSON.stringify(authToken) : undefined), [authToken]);
    const needsMappings = Boolean(authToken && !authToken.permissions);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{
        client: VertesiaClient;
        tokenKey: string | undefined;
        attempt: number;
        state: RoleMappingsState;
    }>();
    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    useEffect(() => {
        if (!needsMappings) return;

        const controller = new AbortController();
        let stopped = false;
        let failures = 0;
        let lastError: unknown;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        const update = (state: RoleMappingsState) => setResult({ client, tokenKey, attempt, state });
        const stop = () => {
            stopped = true;
            clearTimeout(slowTimer);
            clearTimeout(deadlineTimer);
            clearTimeout(retryTimer);
            controller.abort();
        };
        const slowTimer = setTimeout(() => update({ status: 'retrying' }), 5_000);
        // Bound the whole recovery window, including requests that never settle.
        const deadlineTimer = setTimeout(() => {
            stop();
            update({ status: 'error', error: lastError });
        }, 60_000);

        const fetchRoles = async () => {
            try {
                const roles = await client.iam.roles.listSystem({
                    signal: controller.signal,
                    timeoutMs: 15_000,
                    // This hook owns backoff and the overall deadline, not the client's retry policy.
                    retryPolicy: false,
                });
                if (stopped) return;
                stop();
                update({ status: 'ready', roles });
            } catch (error) {
                if (stopped) return;
                lastError = error;
                if (!isTransient(error)) {
                    stop();
                    update({ status: 'error', error });
                    return;
                }
                update({ status: 'retrying' });
                const delay = Math.min(1_000 * 2 ** failures++, 8_000) * (0.5 + Math.random() * 0.5);
                retryTimer = setTimeout(() => {
                    void fetchRoles();
                }, delay);
            }
        };

        update({ status: 'loading' });
        void fetchRoles();
        return stop;
    }, [client, tokenKey, needsMappings, attempt]);

    const state: RoleMappingsState =
        result?.client === client && result.tokenKey === tokenKey && result.attempt === attempt
            ? result.state
            : { status: 'loading' };
    return { state, retry };
}
