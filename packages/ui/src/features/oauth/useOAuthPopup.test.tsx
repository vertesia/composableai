import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOAuthPopup } from './useOAuthPopup.js';

describe('useOAuthPopup', () => {
    let sender: BroadcastChannel;

    beforeEach(() => {
        vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
        sender = new BroadcastChannel('oauth-callback');
    });

    afterEach(() => {
        sender.close();
        vi.restoreAllMocks();
    });

    async function deliver(message: Record<string, unknown>) {
        await act(async () => {
            sender.postMessage(message);
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
    }

    it("ignores another authorization's callback message when the caller names its state", async () => {
        const onComplete = vi.fn();
        const { result } = renderHook(() => useOAuthPopup({ onComplete }));
        act(() => result.current.openOAuthPopup('https://auth.example.com/authorize', { state: 'mine' }));

        await deliver({ type: 'oauth-complete', success: true, state: 'other-tab' });
        await deliver({ type: 'oauth-complete', success: true });
        expect(onComplete).not.toHaveBeenCalled();

        await deliver({ type: 'oauth-complete', success: true, missing_scope: 'files:write', state: 'mine' });
        expect(onComplete).toHaveBeenCalledWith({ success: true, missing_scope: 'files:write', state: 'mine' });
    });

    it('accepts any callback message when the caller names no state', async () => {
        const onComplete = vi.fn();
        const { result } = renderHook(() => useOAuthPopup({ onComplete }));
        act(() => result.current.openOAuthPopup('https://auth.example.com/authorize'));

        await deliver({ type: 'oauth-complete', success: true });
        expect(onComplete).toHaveBeenCalledWith({ success: true });
    });
});
