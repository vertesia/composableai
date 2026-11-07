import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/index.js';
import { AppLayout } from './AppLayout.js';
import { useSidebarToggle } from './SidebarContext.js';

const mounts = vi.fn();

function SidebarContent() {
    useEffect(() => {
        mounts();
    }, []);
    return <div data-testid="sidebar-content" />;
}

function OpenMobileSidebar() {
    const { toggleMobile } = useSidebarToggle();
    return (
        <button type="button" onClick={() => toggleMobile(true)}>
            open
        </button>
    );
}

function setWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function renderLayout() {
    return render(
        <I18nProvider lng="en">
            <AppLayout sidebar={<SidebarContent />}>
                <OpenMobileSidebar />
            </AppLayout>
        </I18nProvider>,
    );
}

describe('AppLayout', () => {
    afterEach(() => {
        mounts.mockClear();
    });

    it('mounts the sidebar once on a large screen', () => {
        setWidth(1280);
        renderLayout();
        expect(screen.getAllByTestId('sidebar-content')).toHaveLength(1);
        expect(mounts).toHaveBeenCalledTimes(1);
    });

    it('mounts no sidebar on a small screen until the mobile panel opens', () => {
        setWidth(640);
        renderLayout();
        expect(screen.queryAllByTestId('sidebar-content')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'open' }));
        expect(screen.getAllByTestId('sidebar-content')).toHaveLength(1);
        expect(mounts).toHaveBeenCalledTimes(1);
    });

    it('switches to the desktop sidebar when the window grows past the breakpoint', () => {
        setWidth(640);
        renderLayout();
        expect(screen.queryAllByTestId('sidebar-content')).toHaveLength(0);

        act(() => {
            setWidth(1280);
            window.dispatchEvent(new Event('resize'));
        });
        expect(screen.getAllByTestId('sidebar-content')).toHaveLength(1);
    });
});
