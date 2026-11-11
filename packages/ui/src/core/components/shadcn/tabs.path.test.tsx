import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from '../../../router/RouterProvider';
import { type Tab, Tabs, TabsBar, TabsPanel } from './tabs';
import { buildTabPath } from './tabsRoute';

function panelTabs(prefix: string, names: string[], content?: (name: string) => React.ReactNode): Tab[] {
    return names.map((name) => ({
        name,
        label: `${prefix} ${name}`,
        content: content ? content(name) : <div>{`${prefix} ${name} panel`}</div>,
    }));
}

const deepTabs = panelTabs('Deep', ['d1', 'd2']);
const innerTabs = panelTabs('Inner', ['i1', 'i2'], (name) =>
    name === 'i1' ? (
        <Tabs tabs={deepTabs} defaultValue="d1">
            <TabsBar />
            <TabsPanel />
        </Tabs>
    ) : (
        <div>Inner i2 panel</div>
    ),
);

let outerCanChangeTab: ((next: string, current?: string) => boolean) | undefined;
let hiddenAllowed = false;

function SettingsPage() {
    const tabs: Tab[] = [
        { name: 'general', label: 'General', content: <div>General panel</div> },
        {
            name: 'apps',
            label: 'Apps',
            content: (
                <Tabs tabs={innerTabs} defaultValue="i1">
                    <TabsBar />
                    <TabsPanel />
                </Tabs>
            ),
        },
        { name: 'hidden', label: 'Hidden', content: <div>Hidden panel</div>, is_allowed: hiddenAllowed },
    ];
    return (
        <Tabs tabs={tabs} defaultValue="general" updatePath canChangeTab={outerCanChangeTab}>
            <TabsBar />
            <TabsPanel />
        </Tabs>
    );
}

function BuildPage() {
    return (
        <Tabs tabs={panelTabs('Build', ['source', 'versions'])} defaultValue="source" updatePath pathParam="section">
            <TabsBar />
            <TabsPanel />
        </Tabs>
    );
}

const routes = [
    { path: '/settings', Component: SettingsPage },
    { path: '/settings/:tab', Component: SettingsPage },
    { path: '/build/:appId/:section', Component: BuildPage },
];

function renderAt(url: string) {
    window.history.replaceState(null, '', url);
    return render(<RouterProvider routes={routes} />);
}

function currentUrl() {
    return window.location.pathname + window.location.search + window.location.hash;
}

describe('buildTabPath', () => {
    it('replaces the parameter segment, or appends the tab when the route has none', () => {
        expect(buildTabPath({ routePath: '/settings/:tab', matchedRoutePath: '/settings/keys' }, 'tab', 'apps')).toBe(
            '/settings/apps',
        );
        expect(buildTabPath({ routePath: '/settings', matchedRoutePath: '/settings' }, 'tab', 'apps')).toBe(
            '/settings/apps',
        );
        expect(
            buildTabPath({ routePath: '/build/:appId/:tab/x', matchedRoutePath: '/build/42/source/x' }, 'tab', 'v'),
        ).toBe('/build/42/v/x');
    });
});

describe('Tabs updatePath', () => {
    afterEach(() => {
        cleanup();
        outerCanChangeTab = undefined;
        hiddenAllowed = false;
        window.history.replaceState(null, '', '/');
    });

    it('redirects a bare route to the default tab without adding a history entry, keeping the query', async () => {
        const length = window.history.length;
        renderAt('/settings?p=1&a=2');

        await waitFor(() => expect(currentUrl()).toBe('/settings/general?p=1&a=2'));
        expect(window.history.length).toBe(length);
        expect(screen.getByText('General panel')).toBeDefined();
    });

    it('reads the tab from the path', () => {
        renderAt('/settings/apps');

        expect(screen.getByText('Deep d1 panel')).toBeDefined();
        expect(screen.queryByText('General panel')).toBeNull();
    });

    it.each([
        ['unknown', '/settings/nope?p=1'],
        ['not-allowed', '/settings/hidden?p=1'],
    ])('replaces an %s tab with the default one', async (_label, url) => {
        const length = window.history.length;
        renderAt(url);

        await waitFor(() => expect(currentUrl()).toBe('/settings/general?p=1'));
        expect(window.history.length).toBe(length);
    });

    it('switches by pushing the new path, keeping the query and clearing the hash', async () => {
        renderAt('/settings/apps?p=1#i2');
        const length = window.history.length;

        fireEvent.click(screen.getByRole('tab', { name: 'General' }));

        await waitFor(() => expect(currentUrl()).toBe('/settings/general?p=1'));
        expect(window.history.length).toBe(length + 1);
        expect(screen.getByText('General panel')).toBeDefined();
    });

    it('neither adds nor clears breadcrumbs when switching or redirecting', async () => {
        const historyChain = [{ title: 'Agents', href: '/agents' }];
        window.history.replaceState({ historyChain }, '', '/settings');
        render(<RouterProvider routes={routes} />);
        await waitFor(() => expect(window.location.pathname).toBe('/settings/general'));
        expect(window.history.state.historyChain).toEqual(historyChain);

        fireEvent.click(screen.getByRole('tab', { name: 'Apps' }));

        await waitFor(() => expect(window.location.pathname).toBe('/settings/apps'));
        expect(window.history.state.historyChain).toEqual(historyChain);
    });

    it('follows the path when another navigation changes it (links, Back/Forward)', async () => {
        renderAt('/settings/general');

        act(() => {
            window.history.pushState(null, '', '/settings/apps');
            window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
        });

        await waitFor(() => expect(screen.getByText('Deep d1 panel')).toBeDefined());
    });

    it('leaves the URL alone when the guard cancels the switch', () => {
        outerCanChangeTab = vi.fn().mockReturnValue(false);
        renderAt('/settings/general');

        fireEvent.click(screen.getByRole('tab', { name: 'Apps' }));

        expect(currentUrl()).toBe('/settings/general');
        expect(screen.getByText('General panel')).toBeDefined();
    });

    it('reads and writes a custom path parameter', async () => {
        renderAt('/build/42/versions');
        expect(screen.getByText('Build versions panel')).toBeDefined();

        fireEvent.click(screen.getByRole('tab', { name: 'Build source' }));

        await waitFor(() => expect(currentUrl()).toBe('/build/42/source'));
    });

    it('keeps tabs directly inside in the hash, replacing the history entry', () => {
        renderAt('/settings/apps');
        const length = window.history.length;

        fireEvent.click(screen.getByRole('tab', { name: 'Inner i2' }));

        expect(currentUrl()).toBe('/settings/apps#i2');
        expect(window.history.length).toBe(length);
        expect(screen.getByText('Inner i2 panel')).toBeDefined();
    });

    it('opens the nested tab named by the hash', () => {
        renderAt('/settings/apps#i2');

        expect(screen.getByText('Inner i2 panel')).toBeDefined();
    });

    it('keeps deeper tabs out of the URL', () => {
        renderAt('/settings/apps#i1');

        fireEvent.click(screen.getByRole('tab', { name: 'Deep d2' }));

        expect(currentUrl()).toBe('/settings/apps#i1');
        expect(screen.getByText('Deep d2 panel')).toBeDefined();
    });
});

describe('Tabs without updatePath', () => {
    afterEach(() => {
        cleanup();
        window.history.replaceState(null, '', '/');
    });

    it('falls back to the hash when there is no router', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        window.history.replaceState(null, '', '/page');
        render(
            <Tabs tabs={panelTabs('Solo', ['a', 'b'])} defaultValue="a" updatePath>
                <TabsBar />
                <TabsPanel />
            </Tabs>,
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Solo b' }));

        expect(currentUrl()).toBe('/page#b');
        warn.mockRestore();
    });

    it('keeps pushing the hash at every level of an unmigrated page', () => {
        window.history.replaceState(null, '', '/page');
        render(
            <Tabs
                tabs={panelTabs('Top', ['a'], () => (
                    <Tabs tabs={innerTabs} defaultValue="i1">
                        <TabsBar />
                        <TabsPanel />
                    </Tabs>
                ))}
                defaultValue="a"
            >
                <TabsBar />
                <TabsPanel />
            </Tabs>,
        );
        const length = window.history.length;

        fireEvent.click(screen.getByRole('tab', { name: 'Inner i2' }));

        expect(currentUrl()).toBe('/page#i2');
        expect(window.history.length).toBe(length + 1);
    });

    it('does not push a tab href when the page controls the tab', () => {
        window.history.replaceState(null, '', '/page');
        const tabs = [
            { name: 'a', label: 'A', href: '#a', content: <div>A panel</div> },
            { name: 'b', label: 'B', href: '#b', content: <div>B panel</div> },
        ];
        render(
            <Tabs tabs={tabs} current="a" onTabChange={() => undefined}>
                <TabsBar />
                <TabsPanel />
            </Tabs>,
        );

        fireEvent.click(screen.getByRole('tab', { name: 'B' }));

        expect(currentUrl()).toBe('/page');
    });
});

const LIST_TABS = ['runs', 'configuration', 'analytics'];

function AgentsPage() {
    return (
        <Tabs tabs={panelTabs('Agents', LIST_TABS)} defaultValue="runs" updatePath>
            <TabsBar />
            <TabsPanel />
        </Tabs>
    );
}

const literalRoutes = [
    { path: '/agents', Component: AgentsPage },
    ...LIST_TABS.map((tab) => ({ path: `/agents/${tab}`, Component: AgentsPage })),
    { path: '/agents/:agentId', Component: ({ agentId }: Record<string, string>) => <div>{`Agent ${agentId}`}</div> },
];

function renderLiteralAt(url: string) {
    window.history.replaceState(null, '', url);
    return render(<RouterProvider routes={literalRoutes} />);
}

describe('Tabs updatePath with one literal route per tab', () => {
    afterEach(() => {
        cleanup();
        window.history.replaceState(null, '', '/');
    });

    it('replaces a literal tab segment instead of appending to it', () => {
        expect(
            buildTabPath({ routePath: '/agents/runs', matchedRoutePath: '/agents/runs' }, 'tab', 'x', LIST_TABS),
        ).toBe('/agents/x');
        expect(buildTabPath({ routePath: '/agents', matchedRoutePath: '/agents' }, 'tab', 'runs', LIST_TABS)).toBe(
            '/agents/runs',
        );
    });

    it('reads the tab from the last segment and switches by replacing it', async () => {
        renderLiteralAt('/agents/configuration?p=1');
        expect(screen.getByText('Agents configuration panel')).toBeDefined();

        fireEvent.click(screen.getByRole('tab', { name: 'Agents analytics' }));

        await waitFor(() => expect(currentUrl()).toBe('/agents/analytics?p=1'));
    });

    it('redirects the bare list to the default tab', async () => {
        renderLiteralAt('/agents?p=1');

        await waitFor(() => expect(currentUrl()).toBe('/agents/runs?p=1'));
    });

    it('opens the tab an old #tab link names, dropping the hash', async () => {
        const length = window.history.length;
        renderLiteralAt('/agents?p=1#configuration');

        await waitFor(() => expect(currentUrl()).toBe('/agents/configuration?p=1'));
        expect(window.history.length).toBe(length);
        expect(screen.getByText('Agents configuration panel')).toBeDefined();
    });

    it('still routes ids at the same level to their own page', () => {
        renderLiteralAt('/agents/run-42');

        expect(screen.getByText('Agent run-42')).toBeDefined();
    });
});
