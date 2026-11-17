// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypeRegistryProvider, useTypeRegistry } from './TypeRegistryProvider.js';

const catalogList = vi.fn();

const session = vi.hoisted(() => ({ projectId: 'project-1' }));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        project: { id: session.projectId },
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

describe('TypeRegistryProvider', () => {
    afterEach(() => {
        session.projectId = 'project-1';
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

    it('issues one catalog request when mounted under StrictMode', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockResolvedValue([]);

        render(
            <StrictMode>
                <TypeRegistryProvider>
                    <Consumer />
                </TypeRegistryProvider>
            </StrictMode>,
        );

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });

        expect(catalogList).toHaveBeenCalledTimes(1);
        expect(latestCtx?.registry).toBeDefined();
    });

    it('does not retry before the server asks when Retry-After exceeds the timer range', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited(3_000_000_000));
        catalogList.mockResolvedValueOnce([]);

        render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);
    });

    it('discards a scheduled retry when the project changes', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited(60_000));
        catalogList.mockResolvedValue([]);

        const { rerender } = render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(catalogList).toHaveBeenCalledTimes(1);

        session.projectId = 'project-2';
        rerender(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(catalogList).toHaveBeenCalledTimes(2);

        // The retry scheduled for the previous project must not fire.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(2);
        expect(latestCtx?.registry).toBeDefined();
    });

    it('caps the retry delay at one minute', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        for (let i = 0; i < 6; i++) catalogList.mockRejectedValueOnce(rateLimited());
        catalogList.mockResolvedValueOnce([]);

        render(
            <TypeRegistryProvider>
                <Consumer />
            </TypeRegistryProvider>,
        );

        // Delays after the six failures: 2 s, 4 s, 8 s, 16 s, 32 s, then 60 s rather than 64 s.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_000 + 4_000 + 8_000 + 16_000 + 32_000);
        });
        expect(catalogList).toHaveBeenCalledTimes(6);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(59_999);
        });
        expect(catalogList).toHaveBeenCalledTimes(6);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(catalogList).toHaveBeenCalledTimes(7);
        expect(latestCtx?.registry).toBeDefined();
    });

    it('still retries a failure of the request started under StrictMode', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        catalogList.mockRejectedValueOnce(rateLimited());
        catalogList.mockResolvedValueOnce([]);

        render(
            <StrictMode>
                <TypeRegistryProvider>
                    <Consumer />
                </TypeRegistryProvider>
            </StrictMode>,
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
