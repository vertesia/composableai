import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentBudgetPauseOverlay, type AgentBudgetRequestContext } from './AgentBudgetPauseOverlay';

const toast = vi.hoisted(() => vi.fn());
vi.mock('@vertesia/ui/core', () => ({ useToast: () => toast }));
vi.mock('@vertesia/ui/i18n', () => ({ useUITranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./ComposerOverlay', () => ({
    ComposerOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComposerOverlayQuestion: ({ onSelect, isLoading }: { onSelect: (id: string) => void; isLoading: boolean }) => (
        <button type="button" disabled={isLoading} onClick={() => onSelect('allocate')}>
            Default token prompt
        </button>
    ),
}));

function setup() {
    const allocateBudget = vi.fn().mockResolvedValue({});
    const client = { agents: { allocateBudget } } as unknown as VertesiaClient;
    return { allocateBudget, props: { client, agentRunId: 'run-1', pause: { limitTokens: 1_000_000 } } };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('budget request overrides', () => {
    it('keeps the default prompt and allocation when no override is supplied', async () => {
        const { props, allocateBudget } = setup();
        render(<AgentBudgetPauseOverlay {...props} />);
        fireEvent.click(screen.getByText('Default token prompt'));
        await waitFor(() => expect(allocateBudget).toHaveBeenCalledWith('run-1', { additional_tokens: 500_000 }));
        expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
    });

    it('automatically allocates once across StrictMode effects and callback changes', async () => {
        const { props, allocateBudget } = setup();
        const callback = vi.fn(async (request: AgentBudgetRequestContext) => {
            await request.allocateBudget(200_000);
        });
        const view = render(
            <StrictMode>
                <AgentBudgetPauseOverlay {...props} onBudgetRequest={callback} />
            </StrictMode>,
        );
        await waitFor(() => expect(allocateBudget).toHaveBeenCalledTimes(1));
        view.rerender(
            <StrictMode>
                <AgentBudgetPauseOverlay {...props} onBudgetRequest={(request) => callback(request)} />
            </StrictMode>,
        );
        expect(callback).toHaveBeenCalledTimes(1);
        expect(allocateBudget).toHaveBeenCalledWith('run-1', { additional_tokens: 200_000 });
        expect(screen.queryByText('Default token prompt')).toBeNull();
    });

    it('renders application UI with allocation and stop actions', async () => {
        const { props, allocateBudget } = setup();
        const stop = vi.fn();
        render(
            <AgentBudgetPauseOverlay
                {...props}
                onStop={stop}
                renderBudgetRequest={(request) => (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                void request.allocateBudget(123_000);
                            }}
                        >
                            Continue working
                        </button>
                        <button type="button" onClick={request.stop}>
                            Finish
                        </button>
                    </>
                )}
            />,
        );
        fireEvent.click(screen.getByText('Continue working'));
        await waitFor(() => expect(allocateBudget).toHaveBeenCalledWith('run-1', { additional_tokens: 123_000 }));
        fireEvent.click(screen.getByText('Finish'));
        expect(stop).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Default token prompt')).toBeNull();
    });

    it('allows a renderer to hide the UI without falling back to the default', () => {
        const { props } = setup();
        const view = render(<AgentBudgetPauseOverlay {...props} renderBudgetRequest={() => null} />);
        expect(view.container.childElementCount).toBe(0);
    });

    it('waits for controls to be enabled and blocks disabled or stale actions', async () => {
        const { props, allocateBudget } = setup();
        const callback = vi.fn();
        let context: AgentBudgetRequestContext | undefined;
        const renderer = (request: AgentBudgetRequestContext) => {
            context = request;
            return null;
        };
        const view = render(
            <AgentBudgetPauseOverlay {...props} disabled onBudgetRequest={callback} renderBudgetRequest={renderer} />,
        );
        expect(callback).not.toHaveBeenCalled();
        await act(async () => {
            expect(await context?.allocateBudget(10)).toBe(false);
        });
        expect(context?.stop).toBeUndefined();
        view.rerender(<AgentBudgetPauseOverlay {...props} onBudgetRequest={callback} renderBudgetRequest={renderer} />);
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
        view.unmount();
        expect(await context?.allocateBudget(10)).toBe(false);
        expect(allocateBudget).not.toHaveBeenCalled();
    });

    it('exposes allocation failures, permits retry, and guards duplicate submissions', async () => {
        const { props, allocateBudget } = setup();
        const failure = new Error('allocation failed');
        allocateBudget.mockRejectedValueOnce(failure);
        let context: AgentBudgetRequestContext | undefined;
        render(
            <AgentBudgetPauseOverlay
                {...props}
                renderBudgetRequest={(request) => {
                    context = request;
                    return null;
                }}
            />,
        );
        await act(async () => {
            expect(await context?.allocateBudget(20)).toBe(false);
        });
        expect(context?.error).toBe(failure);
        expect(toast).not.toHaveBeenCalled();
        await act(async () => {
            const allocation = context?.allocateBudget(20);
            expect(await context?.allocateBudget(20)).toBe(false);
            expect(await allocation).toBe(true);
        });
        expect(allocateBudget).toHaveBeenCalledTimes(2);
        expect(context?.isSubmitting).toBe(true);
        expect(context?.error).toBeUndefined();
    });

    it('blocks retained actions after controls become disabled', async () => {
        const { props, allocateBudget } = setup();
        let context: AgentBudgetRequestContext | undefined;
        const renderer = (request: AgentBudgetRequestContext) => {
            context = request;
            return null;
        };
        const view = render(<AgentBudgetPauseOverlay {...props} renderBudgetRequest={renderer} />);
        const retainedAction = context?.allocateBudget;
        view.rerender(<AgentBudgetPauseOverlay {...props} disabled renderBudgetRequest={renderer} />);
        expect(await retainedAction?.(20)).toBe(false);
        expect(allocateBudget).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid allocations (%s)', async (amount) => {
        const { props, allocateBudget } = setup();
        let context: AgentBudgetRequestContext | undefined;
        render(
            <AgentBudgetPauseOverlay
                {...props}
                renderBudgetRequest={(request) => {
                    context = request;
                    return null;
                }}
            />,
        );
        await act(async () => {
            expect(await context?.allocateBudget(amount)).toBe(false);
        });
        expect(context?.error).toBeInstanceOf(RangeError);
        expect(allocateBudget).not.toHaveBeenCalled();
    });

    it.each(['throw', 'reject'])(
        'exposes application callback errors (%s) without the default prompt',
        async (mode) => {
            const { props } = setup();
            const failure = new Error('application failed');
            let context: AgentBudgetRequestContext | undefined;
            render(
                <AgentBudgetPauseOverlay
                    {...props}
                    onBudgetRequest={() => {
                        if (mode === 'throw') throw failure;
                        return Promise.reject(failure);
                    }}
                    renderBudgetRequest={(request) => {
                        context = request;
                        return null;
                    }}
                />,
            );
            await waitFor(() => expect(context?.error).toBe(failure));
            expect(toast).not.toHaveBeenCalled();
        },
    );
});
