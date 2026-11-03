import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CancelledFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { VertesiaClient } from '@vertesia/client';
import type { WorkflowExecutionBaseParams } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVertesiaClientOptions, withWorkflowHttpExecution, withWorkflowOperation } from './client.js';

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
    for (const request of requests) await options.onRequest?.(request);
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
        const environment = mockEnvironment();
        const firstAttempt = await environment.run(captureRequestIdentity, payload());
        const retryAttempt = await environment.run(captureRequestIdentity, payload());
        assertRequestIdentity(firstAttempt);
        assertRequestIdentity(retryAttempt);

        expect(firstAttempt).toEqual(retryAttempt);
        expect(firstAttempt.requestIds[0]).toMatch(/^workflow:operation:[a-f0-9]{64}$/);
        expect(firstAttempt.requestIds[1]).not.toBe(firstAttempt.requestIds[0]);
    });

    it('keeps explicitly named operations stable when call order changes', async () => {
        const environment = mockEnvironment();
        const execute = (order: string[]) =>
            environment.run(async () => {
                const options = getVertesiaClientOptions(payload());
                return Object.fromEntries(
                    order.map((key) =>
                        withWorkflowOperation(key, () => {
                            const request = new Request(`https://store.example.com/${key}`);
                            options.onRequest?.(request);
                            return [key, request.headers.get('x-request-id')];
                        }),
                    ),
                );
            });
        const first = await execute(['first', 'second']);
        expect(await execute(['second', 'first'])).toEqual(first);
        expect(first.first).not.toEqual(first.second);
    });

    it('surfaces pacing immediately on both API clients for durable Temporal retries', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response('{}', {
                    status: 429,
                    headers: {
                        'content-type': 'application/json',
                        'x-ratelimit-reason': 'pacing',
                        'x-ratelimit-retry-ms': '50',
                    },
                }),
        );
        const environment = mockEnvironment();
        await environment.run(async () => {
            const client = new VertesiaClient(getVertesiaClientOptions(payload()));
            await expect(client.get('/one')).rejects.toMatchObject({ status: 429 });
            await expect(client.store.get('/two')).rejects.toMatchObject({ status: 429 });
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
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
        const environment = mockEnvironment();
        const execution = environment.run(async () => {
            const configuredFetch = await getVertesiaClientOptions(payload()).fetch;
            if (!configuredFetch) throw new Error('Workflow fetch is not configured');
            return configuredFetch(new Request('https://studio.example.com/api/v1/execute'));
        });
        const rejection = expect(execution).rejects.toMatchObject({
            name: 'AbortError',
            cause: expect.any(CancelledFailure),
        });

        await fetchStarted;
        environment.cancel();

        await rejection;
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('does not log a request cancelled with its Temporal activity as a connection failure', async () => {
        let markFetchStarted: (() => void) | undefined;
        const fetchStarted = new Promise<void>((resolve) => {
            markFetchStarted = resolve;
        });
        vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
            const signal = init?.signal;
            markFetchStarted?.();
            return new Promise<Response>((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
        });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const environment = mockEnvironment();
        const execution = environment.run(() =>
            new VertesiaClient(getVertesiaClientOptions(payload())).agents.updateStatus('run-1', {
                status: 'cancelled',
            }),
        );
        const rejection = expect(execution).rejects.toMatchObject({
            status: 0,
            payload: { name: 'AbortError', cause: expect.any(CancelledFailure) },
        });

        await fetchStarted;
        environment.cancel();

        await rejection;
        expect(consoleError).not.toHaveBeenCalled();
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
        const environment = mockEnvironment();

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

function tokenWithClaims(claims: Record<string, unknown>): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

function payloadWithToken(authToken: string): WorkflowExecutionBaseParams {
    return { ...payload(), auth_token: authToken };
}

describe('workflow client token server URL resolution', () => {
    const resolveTokenServerUrl = (claims: Record<string, unknown>) =>
        getVertesiaClientOptions(payloadWithToken(tokenWithClaims(claims))).tokenServerUrl;

    it('falls back to the issuer when the endpoints claim is absent (non-production issuer)', () => {
        // decodeEndpoints(undefined) would return the production map (token: https://sts.vertesia.io);
        // an absent claim must instead fall back to iss so a dev1 token mints against dev1.
        expect(resolveTokenServerUrl({ iss: 'https://sts.dev1.vertesia.io', sub: 'test' })).toBe(
            'https://sts.dev1.vertesia.io',
        );
    });

    it('uses the token endpoint from an object endpoints claim', () => {
        expect(
            resolveTokenServerUrl({
                iss: 'https://sts.dev1.vertesia.io',
                sub: 'test',
                endpoints: { token: 'https://token-server-dev-feat.api.dev1.vertesia.io' },
            }),
        ).toBe('https://token-server-dev-feat.api.dev1.vertesia.io');
    });

    it('falls back to the issuer when an object endpoints claim omits token', () => {
        expect(
            resolveTokenServerUrl({
                iss: 'https://sts.dev1.vertesia.io',
                sub: 'test',
                endpoints: { studio: 'https://studio.example.com' },
            }),
        ).toBe('https://sts.dev1.vertesia.io');
    });

    it('derives the token endpoint from a string (domain) endpoints claim', () => {
        expect(
            resolveTokenServerUrl({
                iss: 'https://sts.dev1.vertesia.io',
                sub: 'test',
                endpoints: 'api.us1.vertesia.io',
            }),
        ).toBe('https://sts.us1.vertesia.io');
    });
});

it('preserves data import IDs across retries and gives distinct operations different IDs', async () => {
    const environment = mockEnvironment();
    const run = () =>
        environment.run(async () => {
            const policy = getVertesiaClientOptions(payload()).retryPolicy;
            if (!policy || typeof policy === 'boolean' || !policy.importId)
                throw new Error('Expected durable import identity');
            return [
                withWorkflowOperation('import-one', policy.importId),
                withWorkflowOperation('import-two', policy.importId),
            ];
        });
    const first = await run();
    expect(await run()).toEqual(first);
    expect(first[0]).toMatch(/^[a-f0-9]{24}$/);
    expect(first[0]).not.toBe(first[1]);
});

function mockEnvironment(info?: ConstructorParameters<typeof MockActivityEnvironment>[0]): MockActivityEnvironment {
    const environment = new MockActivityEnvironment(info);
    environment.run = new Proxy(environment.run, {
        apply(target, receiver, args: unknown[]) {
            const activity = args[0] as (...parameters: unknown[]) => unknown;
            return Reflect.apply(target, receiver, [
                (...parameters: unknown[]) => withWorkflowHttpExecution(() => activity(...parameters)),
                ...args.slice(1),
            ]);
        },
    });
    return environment;
}
it('preserves public SDK retry defaults outside the opt-in worker scope', async () => {
    await new MockActivityEnvironment().run(async () => {
        const options = getVertesiaClientOptions(payload());
        expect(options.pacingRetry).toBeUndefined();
        expect(options.retryPolicy).toBeUndefined();
    });
});
it('shares create/import counters across clients in one activity attempt and repeats them on retry', async () => {
    const environment = mockEnvironment();
    const run = () =>
        environment.run(async () => {
            const first = getVertesiaClientOptions(payload()).retryPolicy;
            const second = getVertesiaClientOptions(payload()).retryPolicy;
            if (!first?.idempotencyKey || !second?.idempotencyKey || !first.importId || !second.importId)
                throw new Error('Expected durable operation identity');
            return [
                first.idempotencyKey({ name: 'same' }),
                second.idempotencyKey({ name: 'same' }),
                first.importId({ path: 'same' }),
                second.importId({ path: 'same' }),
            ];
        });
    const first = await run();
    expect(new Set(first).size).toBe(4);
    expect(await run()).toEqual(first);
});
it('uses a fixed-size request ID for maximum-length workflow and activity identifiers', async () => {
    const environment = mockEnvironment({
        activityId: 'a'.repeat(1000),
        workflowExecution: { workflowId: 'w'.repeat(1000), runId: 'r'.repeat(36) },
    });
    const result = await environment.run(async () => {
        const options = getVertesiaClientOptions(payload());
        const request = new Request('https://api.example.test/objects', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ large: 'x'.repeat(1000000) }),
        });
        const clone = vi.spyOn(request, 'clone');
        options.onRequest?.(request);
        expect(clone).not.toHaveBeenCalled();
        return request.headers.get('x-request-id');
    });
    expect(result?.length).toBeLessThan(100);
});
