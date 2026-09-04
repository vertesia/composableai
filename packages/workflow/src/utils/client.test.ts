import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { WorkflowExecutionBaseParams } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVertesiaClientOptions } from './client.js';

const TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature';

function payload(): WorkflowExecutionBaseParams {
    return {
        account_id: 'account-1',
        project_id: 'project-1',
        auth_token: TOKEN,
        config: { studio_url: 'https://studio.example.com', store_url: 'https://store.example.com' },
        vars: {},
    };
}

async function captureRequestIdentity(input: WorkflowExecutionBaseParams): Promise<{
    requestIds: string[];
}> {
    const options = getVertesiaClientOptions(input);
    const requests = [new Request('https://studio.example.com/one'), new Request('https://store.example.com/two')];
    for (const request of requests) options.onRequest?.(request);
    return {
        requestIds: requests.map((request) => request.headers.get('x-request-id') ?? ''),
    };
}

function assertRequestIdentity(value: unknown): asserts value is Awaited<ReturnType<typeof captureRequestIdentity>> {
    if (
        !value ||
        typeof value !== 'object' ||
        !('requestIds' in value) ||
        !Array.isArray(value.requestIds) ||
        value.requestIds.some((item) => typeof item !== 'string')
    ) {
        throw new Error('Activity result does not contain request identity');
    }
}

describe('workflow API request provenance', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not mark non-activity utility requests', () => {
        const options = getVertesiaClientOptions(payload());
        expect(options.onRequest).toBeUndefined();
    });

    it('uses deterministic per-activity request ids', async () => {
        const environment = new MockActivityEnvironment();
        const firstAttempt = await environment.run(captureRequestIdentity, payload());
        const retryAttempt = await environment.run(captureRequestIdentity, payload());
        assertRequestIdentity(firstAttempt);
        assertRequestIdentity(retryAttempt);

        expect(firstAttempt).toEqual(retryAttempt);
        expect(firstAttempt.requestIds[0]).toMatch(/:0$/);
        expect(firstAttempt.requestIds[1]).toMatch(/:1$/);
    });

    it('cancels workflow HTTP requests when the Temporal activity is cancelled', async () => {
        let markFetchStarted: (() => void) | undefined;
        const fetchStarted = new Promise<void>((resolve) => {
            markFetchStarted = resolve;
        });
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
            const signal = init?.signal;
            expect(init).toHaveProperty('dispatcher');
            markFetchStarted?.();
            return new Promise<Response>((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
        });
        const environment = new MockActivityEnvironment();
        const execution = environment.run(async () => {
            const configuredFetch = await getVertesiaClientOptions(payload()).fetch;
            if (!configuredFetch) throw new Error('Workflow fetch is not configured');
            return configuredFetch(new Request('https://studio.example.com/api/v1/execute'));
        });
        const rejection = expect(execution).rejects.toBeDefined();

        await fetchStarted;
        environment.cancel();

        await rejection;
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('closes a pending workflow HTTP request when the Temporal activity is cancelled', async () => {
        let markRequestStarted: (() => void) | undefined;
        const requestStarted = new Promise<void>((resolve) => {
            markRequestStarted = resolve;
        });
        let markClientDisconnected: (() => void) | undefined;
        const clientDisconnected = new Promise<void>((resolve) => {
            markClientDisconnected = resolve;
        });
        const server = createServer((_req, res) => {
            markRequestStarted?.();
            res.once('close', () => {
                if (!res.writableFinished) markClientDisconnected?.();
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address() as AddressInfo;
        const environment = new MockActivityEnvironment();

        try {
            const execution = environment.run(async () => {
                const configuredFetch = await getVertesiaClientOptions(payload()).fetch;
                if (!configuredFetch) throw new Error('Workflow fetch is not configured');
                return configuredFetch(new Request(`http://127.0.0.1:${port}/pending`));
            });
            const rejection = expect(execution).rejects.toBeDefined();

            await requestStarted;
            environment.cancel();

            await rejection;
            await clientDisconnected;
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
        }
    });
});
