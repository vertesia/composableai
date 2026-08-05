import type { AuthTokenPayload, PlatformEvent } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEventHookPayload, AppLifecycleHookContext } from '../types.js';

const authorizeMock = vi.hoisted(() => vi.fn());

vi.mock('../auth.js', () => ({ authorize: authorizeMock }));

import { createToolServer } from '../server.js';

const event = {
    event_id: 'event-1',
    root_event_id: 'event-1',
    hop_count: 0,
    event_category: 'content',
    action: 'updated',
    resource_type: 'content_object',
    resource_id: 'object-1',
    account_id: 'account-1',
    project_id: 'project-1',
    tenant_id: 'account-1_project-1',
    timestamp: '2026-08-05T10:00:00.000Z',
    source: 'zeno-server',
} satisfies PlatformEvent;

const eventPayload = {
    event,
    delivery: {
        id: 'delivery-1',
        subscription_id: 'subscription-1',
        attempt: 1,
    },
} satisfies AppEventHookPayload;

describe('app hooks', () => {
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

    it('executes an event hook with the canonical delivery envelope and authenticated context', async () => {
        const contentUpdated = vi.fn(async (_payload: AppEventHookPayload) => ({ message: 'processed' }));
        const app = createToolServer({
            disableHtml: true,
            hooks: [
                {
                    kind: 'event',
                    name: 'content-updated',
                    description: 'Processes updated content.',
                    handler: contentUpdated,
                },
            ],
        });

        const response = await app.request('/api/hooks/content-updated', {
            method: 'POST',
            headers: { Authorization: 'Bearer project-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ ok: true, message: 'processed' });
        expect(contentUpdated).toHaveBeenCalledWith(
            eventPayload,
            expect.objectContaining({ token: 'project-token', payload: { project: { id: 'project-1' } } }),
        );
    });

    it('rejects malformed event hook payloads before authentication', async () => {
        const handler = vi.fn(async () => undefined);
        const app = createToolServer({
            disableHtml: true,
            hooks: [{ kind: 'event', name: 'content-updated', handler }],
        });

        const response = await app.request('/api/hooks/content-updated', {
            method: 'POST',
            headers: { Authorization: 'Bearer project-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: eventPayload.event }),
        });

        expect(response.status).toBe(400);
        expect(handler).not.toHaveBeenCalled();
        expect(authorizeMock).not.toHaveBeenCalled();
    });

    it.each(['install', 'uninstall'])('reserves the lifecycle hook name %s', (name) => {
        expect(() =>
            createToolServer({
                disableHtml: true,
                hooks: [{ kind: 'event', name, handler: async () => undefined }],
            }),
        ).toThrow(`App event hook name is reserved: ${name}`);
    });

    it('rejects event hook names that are not safe path segments', () => {
        expect(() =>
            createToolServer({
                disableHtml: true,
                hooks: [{ kind: 'event', name: 'content/updated', handler: async () => undefined }],
            }),
        ).toThrow('Invalid app event hook name: content/updated');
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
        ).toThrow('Duplicate app hook: install');
    });
});
