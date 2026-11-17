// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypeRegistryProvider, typeCatalogRetryDelayMs, useTypeRegistry } from './TypeRegistryProvider.js';

const catalogList = vi.fn();

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        project: { id: 'project-1' },
        store: { types: { catalog: { list: catalogList } } },
    }),
}));

let latestCtx: ReturnType<typeof useTypeRegistry> | undefined;

function Consumer() {
    latestCtx = useTypeRegistry();
    return null;
}

/** A rejection shaped like the API client's request error, with the server's Retry-After hint. */
function rateLimited(retryAfterMs?: number) {
    return Object.assign(new Error('429 Too Many Requests'), { status: 429, retryAfterMs });
}

describe('typeCatalogRetryDelayMs', () => {
    it('backs off exponentially, capped at one minute', () => {
        expect(typeCatalogRetryDelayMs(1)).toBe(2_000);
        expect(typeCatalogRetryDelayMs(2)).toBe(4_000);
        expect(typeCatalogRetryDelayMs(3)).toBe(8_000);
        expect(typeCatalogRetryDelayMs(10)).toBe(60_000);
    });

    it('never retries sooner than the server asks', () => {
        expect(typeCatalogRetryDelayMs(1, 5_000)).toBe(5_000);
        expect(typeCatalogRetryDelayMs(1, 90_000)).toBe(90_000);
    });
});

describe('TypeRegistryProvider', () => {
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        catalogList.mockReset();
        latestCtx = undefined;
        vi.restoreAllMocks();
    });

    it('does not request again right after a failed load, even with two consumers mounted', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValue(rateLimited());

        render(
            <TypeRegistryProvider>
                <Consumer />
                <Consumer />
            </TypeRegistryProvider>,
        );

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(catalogList).toHaveBeenCalledTimes(1);
        expect(latestCtx?.isLoading).toBe(false);
        expect(latestCtx?.registry).toBeUndefined();
    });

    it('retries after the server Retry-After delay and then populates the registry', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited(5_000));
        catalogList.mockResolvedValueOnce([]);

        render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(4_999);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(catalogList).toHaveBeenCalledTimes(2);
        expect(latestCtx?.registry).toBeDefined();
        expect(latestCtx?.isLoading).toBe(false);
    });

    it('keeps retrying with growing delays until the load succeeds', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited());
        catalogList.mockRejectedValueOnce(rateLimited());
        catalogList.mockRejectedValueOnce(rateLimited());
        catalogList.mockResolvedValueOnce([]);

        render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(2);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(4_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(3);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(8_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(4);
        expect(latestCtx?.registry).toBeDefined();
    });

    it('lets reload() retry at once, without waiting for the scheduled retry', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited(60_000));
        catalogList.mockResolvedValueOnce([]);

        render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);

        await act(async () => {
            await latestCtx?.reload();
        });
        expect(catalogList).toHaveBeenCalledTimes(2);
        expect(latestCtx?.registry).toBeDefined();

        // The scheduled retry was cancelled by the successful reload.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(2);
    });

    it('stops retrying once unmounted', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValue(rateLimited());

        const { unmount } = render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);

        unmount();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);
    });

    it('discards a request that fails after unmount instead of scheduling a retry', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let rejectRequest: (err: unknown) => void = () => {};
        catalogList.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectRequest = reject;
            }),
        );

        const { unmount } = render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );
        expect(catalogList).toHaveBeenCalledTimes(1);

        unmount();
        await act(async () => {
            rejectRequest(rateLimited());
            await vi.advanceTimersByTimeAsync(120_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);
    });

    it('does not add a request when a consumer mounts while a retry is scheduled', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited());
        catalogList.mockResolvedValueOnce([]);

        const { rerender } = render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);

        rerender(
            <TypeRegistryProvider>
                <Consumer />
                <Consumer />
            </TypeRegistryProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(2);
        expect(latestCtx?.registry).toBeDefined();
    });
});
