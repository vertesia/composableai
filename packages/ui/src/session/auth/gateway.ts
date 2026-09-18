import type { AuthTokenPayload } from '@vertesia/common';

export function usesGatewaySession(): boolean {
    if (typeof window === 'undefined' || window.parent !== window) return false;
    const config = window.__VERTESIA_RUNTIME_CONFIG__;
    return config?.authMode === 'central' && config.gatewaySession === true;
}

export function gatewayLoginUrl(): string {
    const current = new URL(window.location.href);
    const url = new URL('/__appgen/auth/login', current.origin);
    url.searchParams.set('target', `${current.pathname}${current.search}${current.hash}`);
    return url.toString();
}

/** Same-origin cookie transport. The gateway attaches its OAuth credential upstream. */
export async function gatewayFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);
    if (new URL(request.url).origin !== window.location.origin) {
        throw new Error('Gateway session requests must stay on the application origin');
    }
    const headers = new Headers(request.headers);
    headers.delete('authorization');
    headers.set('x-vertesia-app-session', '1');
    const response = await fetch(new Request(request, { headers, credentials: 'same-origin', cache: 'no-store' }));
    if (response.status === 401 && response.headers.get('x-vertesia-session-required') === '1') {
        window.location.replace(gatewayLoginUrl());
        // Navigation owns recovery. Do not fall back to Firebase or the direct broker flow.
        return new Promise(() => {});
    }
    return response;
}

export async function loadGatewaySession(): Promise<AuthTokenPayload> {
    const response = await gatewayFetch(new URL('/__appgen/session', window.location.origin).toString());
    if (!response.ok) throw new Error(`Application session could not be loaded (${response.status})`);
    const payload: AuthTokenPayload = await response.json();
    if (!payload.sub || !payload.account?.id || !payload.project?.id) {
        throw new Error('Application session returned invalid user information');
    }
    return payload;
}

export async function logoutGatewaySession(): Promise<void> {
    const response = await gatewayFetch(new URL('/__appgen/session/logout', window.location.origin).toString(), {
        method: 'POST',
    });
    if (!response.ok) throw new Error(`Application sign-out failed (${response.status})`);
}
