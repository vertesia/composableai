import { render, screen } from '@testing-library/react';
import type { AuthTokenPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { SplashScreen } from './SplashScreen';

const session = { isLoading: true, authToken: undefined as AuthTokenPayload | undefined };
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => session }));

describe('SplashScreen handoff', () => {
    it.each([true, false])('removes the splash immediately when a token arrives with isLoading=%s', (isLoading) => {
        session.isLoading = true;
        session.authToken = undefined;
        const view = render(<SplashScreen icon={<span>Startup indicator</span>} />);
        expect(screen.getByText('Startup indicator')).toBeTruthy();

        session.isLoading = isLoading;
        session.authToken = {} as AuthTokenPayload;
        view.rerender(<SplashScreen icon={<span>Startup indicator</span>} />);
        // No fading splash remains over the permission gate's connection screen.
        expect(screen.queryByText('Startup indicator')).toBeNull();
    });
});
