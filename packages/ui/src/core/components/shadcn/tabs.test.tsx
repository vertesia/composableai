import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabsBar, TabsPanel } from './tabs';

const TABS = [
    { name: 'first', label: 'First', href: '#first', content: <div>First panel</div> },
    { name: 'second', label: 'Second', href: '#second', content: <div>Second panel</div> },
];

function renderTabs(canChangeTab?: (nextTab: string, currentTab?: string) => boolean) {
    return render(
        <Tabs tabs={TABS} defaultValue="first" canChangeTab={canChangeTab}>
            <TabsBar />
            <TabsPanel />
        </Tabs>,
    );
}

describe('Tabs canChangeTab', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('cancels the switch and leaves the hash alone when the guard returns false', () => {
        const canChangeTab = vi.fn().mockReturnValue(false);
        renderTabs(canChangeTab);

        fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

        expect(canChangeTab).toHaveBeenCalledWith('second', 'first');
        expect(screen.getByText('First panel')).toBeDefined();
        expect(screen.queryByText('Second panel')).toBeNull();
        expect(window.location.hash).toBe('');
    });

    it('allows the switch when the guard returns true', () => {
        const canChangeTab = vi.fn().mockReturnValue(true);
        renderTabs(canChangeTab);

        fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

        expect(screen.getByText('Second panel')).toBeDefined();
        expect(window.location.hash).toBe('#second');
    });

    it('does not consult the guard when the active tab is clicked again', () => {
        const canChangeTab = vi.fn().mockReturnValue(false);
        renderTabs(canChangeTab);

        fireEvent.click(screen.getByRole('tab', { name: 'First' }));

        expect(canChangeTab).not.toHaveBeenCalled();
        expect(screen.getByText('First panel')).toBeDefined();
    });

    it('still switches from a hash change so a cancelled switch can be resumed', () => {
        const canChangeTab = vi.fn().mockReturnValue(false);
        renderTabs(canChangeTab);

        window.location.hash = 'second';
        fireEvent(window, new HashChangeEvent('hashchange'));

        expect(screen.getByText('Second panel')).toBeDefined();
    });
});
