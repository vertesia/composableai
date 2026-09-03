import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/index.js';
import { HamburgerButton } from './Navbar.js';
import { SidebarContext } from './SidebarContext.js';

function renderHamburger(options: { isOpen?: boolean; toggleDesktop?: () => void; toggleMobile?: () => void } = {}) {
    const toggleDesktop = options.toggleDesktop ?? vi.fn();
    const toggleMobile = options.toggleMobile ?? vi.fn();

    render(
        <I18nProvider lng="en">
            <SidebarContext.Provider
                value={{
                    isOpen: options.isOpen ?? false,
                    toggleDesktop,
                    toggleMobile,
                }}
            >
                <HamburgerButton />
            </SidebarContext.Provider>
        </I18nProvider>,
    );

    return { toggleDesktop, toggleMobile };
}

describe('HamburgerButton', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    });

    it('exposes an accessible name and the current expanded state', () => {
        renderHamburger({ isOpen: true });

        const button = screen.getByRole('button', { name: 'Toggle navigation menu' });
        expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('uses the desktop toggle at a desktop viewport', () => {
        const { toggleDesktop, toggleMobile } = renderHamburger();

        fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));

        expect(toggleDesktop).toHaveBeenCalledOnce();
        expect(toggleMobile).not.toHaveBeenCalled();
    });

    it('uses the mobile toggle at a narrow viewport', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
        const { toggleDesktop, toggleMobile } = renderHamburger();

        fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));

        expect(toggleMobile).toHaveBeenCalledOnce();
        expect(toggleDesktop).not.toHaveBeenCalled();
    });
});
