import { render, screen } from '@testing-library/react';
import type { AuthTokenPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { SplashScreen } from './SplashScreen';

const session = { isLoading: true, authToken: undefined as AuthTokenPayload | undefined };
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => session }));

describe('SplashScreen handoff', () => {
    it('never mounts a splash over an already ready sign-in view', () => {
        session.isLoading = false;
        session.authToken = undefined;
        render(<SplashScreen icon={<span>Startup indicator</span>} />);
        expect(screen.queryByText('Startup indicator')).toBeNull();
    });

    it('removes the default splash immediately when loading completes without a token', () => {
        session.isLoading = true;
        session.authToken = undefined;
        const view = render(<SplashScreen icon={<span>Startup indicator</span>} />);
        session.isLoading = false;
        view.rerender(<SplashScreen icon={<span>Startup indicator</span>} />);
        expect(screen.queryByText('Startup indicator')).toBeNull();
    });

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
    it('gives a custom screen the whole page without the default animation and unmounts it on completion', () => {
        session.isLoading = true;
        session.authToken = undefined;
        const CustomScreen = () => <main>Branded authentication</main>;
        const view = render(<SplashScreen Screen={CustomScreen} icon={<span>Old spinner</span>} />);
        expect(view.container.firstElementChild?.tagName).toBe('MAIN');
        expect(screen.queryByText('Old spinner')).toBeNull();
        session.isLoading = false;
        view.rerender(<SplashScreen Screen={CustomScreen} />);
        expect(screen.queryByText('Branded authentication')).toBeNull();
    });

    it('hands a custom screen off to permissions as soon as the token arrives', () => {
        session.isLoading = true;
        session.authToken = undefined;
        const CustomScreen = () => <main>Branded authentication</main>;
        const view = render(<SplashScreen Screen={CustomScreen} />);
        session.authToken = {} as AuthTokenPayload;
        view.rerender(<SplashScreen Screen={CustomScreen} />);
        expect(screen.queryByText('Branded authentication')).toBeNull();
    });
});
