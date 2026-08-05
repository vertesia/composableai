import type { AuthTokenPayload } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppLifecycleHookContext } from '../types.js';

const authorizeMock = vi.hoisted(() => vi.fn());

vi.mock('../auth.js', () => ({ authorize: authorizeMock }));

import { createToolServer } from '../server.js';

describe('app lifecycle hooks', () => {
    beforeEach(() => {
        authorizeMock.mockReset();
        authorizeMock.mockResolvedValue({
            token: 'project-token',
            payload: { project: { id: 'project-1' } } as AuthTokenPayload,
            getClient: vi.fn(),
        });
    });

    it('executes a registered hook with authenticated context and metadata', async () => {
        const install = vi.fn(async (_context: AppLifecycleHookContext) => ({ message: 'installed' }));
        const app = createToolServer({
            disableHtml: true,
            hooks: [{ kind: 'lifecycle', name: 'install', handler: install }],
        });

        const response = await app.request('/api/hooks/install', {
            method: 'POST',
            headers: { Authorization: 'Bearer project-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata: { app_install_id: 'install-1', app_settings: { locale: 'en' } } }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ ok: true, message: 'installed' });
        expect(install).toHaveBeenCalledWith(
            expect.objectContaining({
                token: 'project-token',
                metadata: { app_install_id: 'install-1', app_settings: { locale: 'en' } },
            }),
        );
    });

    it('returns 404 when the hook is not registered', async () => {
        const app = createToolServer({ disableHtml: true });

        const response = await app.request('/api/hooks/uninstall', {
            method: 'POST',
            headers: { Authorization: 'Bearer project-token', 'Content-Type': 'application/json' },
            body: '{}',
        });

        expect(response.status).toBe(404);
        expect(authorizeMock).not.toHaveBeenCalled();
    });

    it('rejects duplicate lifecycle hook registrations', () => {
        const handler = vi.fn(async () => undefined);

        expect(() =>
            createToolServer({
                disableHtml: true,
                hooks: [
                    { kind: 'lifecycle', name: 'install', handler },
                    { kind: 'lifecycle', name: 'install', handler },
                ],
            }),
        ).toThrow('Duplicate app lifecycle hook: install');
    });
});
