import { cleanup, render, screen } from '@testing-library/react';
import * as session from '@vertesia/ui/session';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_PREVIEW_SCREENS, AuthScreenPreview, mountAuthScreenPreview } from './AuthScreenPreview';
import * as signin from './login/signInUtils';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('shared auth visual previews', () => {
    it.each(AUTH_PREVIEW_SCREENS.filter((name) => name !== 'boot'))(
        'renders %s without initializing or changing authentication',
        (name) => {
            const firebase = vi.spyOn(session, 'getFirebaseAuth');
            const reset = vi.spyOn(signin, 'resetSignInState');
            const { container } = render(<AuthScreenPreview screen={name} branding={{ name: 'Example' }} />);
            expect(container.querySelector('[inert]')?.textContent?.trim()).not.toBe('');
            expect(screen.getByText(`Auth preview: ${name}`)).toBeTruthy();
            expect(firebase).not.toHaveBeenCalled();
            expect(reset).not.toHaveBeenCalled();
        },
    );

    it('retains branding and full screen overrides, with links to the shared boot URL', () => {
        render(
            <AuthScreenPreview
                screen="loading"
                branding={{ name: 'Example' }}
                screens={{ Loading: () => <p>Custom loader fixture</p> }}
            />,
        );
        expect(screen.getByText('Custom loader fixture')).toBeTruthy();
        expect(screen.getByText('boot').getAttribute('href')).toContain('__vertesia_boot=slow');
        expect(screen.getByText('pending').getAttribute('href')).toContain('__vertesia_auth=pending');
    });

    it('keeps the React root empty for boot previews', async () => {
        const container = document.createElement('div');
        await mountAuthScreenPreview(container, 'boot');
        expect(container.childNodes).toHaveLength(0);
    });
});
