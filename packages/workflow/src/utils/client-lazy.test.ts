import { afterEach, expect, it, vi } from 'vitest';

const { loadUndici, createDispatcher } = vi.hoisted(() => {
    return {
        loadUndici: vi.fn(),
        createDispatcher: vi.fn((_options: { headersTimeout: number; bodyTimeout: number }) => undefined),
    };
});

vi.mock('undici', () => {
    loadUndici();
    return {
        EnvHttpProxyAgent: class {
            constructor(options: { headersTimeout: number; bodyTimeout: number }) {
                createDispatcher(options);
            }
        },
    };
});

import { getVertesiaClientOptions } from './client.js';

afterEach(() => vi.unstubAllGlobals());

it('defers dispatcher loading, retries failed construction, and shares concurrent initialization', async () => {
    const options = getVertesiaClientOptions({
        account_id: 'account-1',
        project_id: 'project-1',
        auth_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature',
        config: { studio_url: 'https://studio.example.com', store_url: 'https://store.example.com' },
        vars: {},
    });
    expect(loadUndici).not.toHaveBeenCalled();
    expect(createDispatcher).not.toHaveBeenCalled();
    if (!options.fetch) throw new Error('Missing workflow fetch');
    const fetch = await options.fetch;
    const networkFetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', networkFetch);
    const aborted = AbortSignal.abort(new Error('cancelled'));
    await expect(fetch('https://studio.example.com', { signal: aborted })).rejects.toThrow('cancelled');
    expect(loadUndici).not.toHaveBeenCalled();

    createDispatcher.mockImplementationOnce(() => {
        throw new Error('dispatcher initialization failed');
    });
    await expect(fetch('https://studio.example.com')).rejects.toThrow('dispatcher initialization failed');
    expect(networkFetch).not.toHaveBeenCalled();
    const controller = new AbortController();
    const cancelled = fetch('https://studio.example.com/cancelled', { signal: controller.signal });
    const requests = [fetch('https://studio.example.com/one'), fetch('https://studio.example.com/two')];
    controller.abort(new Error('cancelled during initialization'));
    await expect(cancelled).rejects.toThrow('cancelled during initialization');
    await Promise.all(requests);
    expect(createDispatcher).toHaveBeenCalledTimes(2);
    expect(createDispatcher).toHaveBeenLastCalledWith({ headersTimeout: 0, bodyTimeout: 0 });
    expect(networkFetch).toHaveBeenCalledTimes(2);
    const dispatcher = networkFetch.mock.calls[0][1].dispatcher;
    expect(dispatcher).toBeDefined();
    expect(networkFetch.mock.calls[1][1].dispatcher).toBe(dispatcher);
});
