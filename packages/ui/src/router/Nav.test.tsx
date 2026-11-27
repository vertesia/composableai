// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavLink } from './Nav';
import { NestedNavigationContext } from './NestedNavigationContext';
import { NestedRouterProvider } from './NestedRouterProvider';
import { RouterProvider } from './RouterProvider';

function renderAt(path: string, ui: React.ReactNode) {
    window.history.pushState({}, '', path);
    return render(<RouterProvider routes={[{ path: '/store/*', Component: () => <>{ui}</> }]} />);
}

describe('NavLink', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
    });

    afterEach(() => {
        cleanup();
        window.history.pushState({}, '', '/');
    });

    it('renders the href a click navigates to inside a nested router', () => {
        renderAt(
            '/store/objects',
            <NestedRouterProvider
                routes={[{ path: '/objects', Component: () => <NavLink href="/rules/r1">Rule</NavLink> }]}
            />,
        );

        const link = screen.getByRole('link', { name: 'Rule' });
        expect(link.getAttribute('href')).toBe('/store/rules/r1');

        fireEvent.click(link);
        expect(window.location.pathname).toBe('/store/rules/r1');
    });

    it('includes every base path of doubly nested routers', () => {
        const Inner = () => (
            <NestedRouterProvider
                routes={[{ path: '/runs', Component: () => <NavLink href="/runs/r1">Run</NavLink> }]}
            />
        );
        renderAt('/store/agents/runs', <NestedRouterProvider routes={[{ path: '/agents/*', Component: Inner }]} />);

        expect(screen.getByRole('link', { name: 'Run' }).getAttribute('href')).toBe('/store/agents/runs/r1');
    });

    it('renders an absolute href with topLevelNav', () => {
        renderAt(
            '/store/objects',
            <NestedRouterProvider
                routes={[
                    {
                        path: '/objects',
                        Component: () => (
                            <NavLink href="/studio/build/app-1" topLevelNav>
                                App
                            </NavLink>
                        ),
                    },
                ]}
            />,
        );

        expect(screen.getByRole('link', { name: 'App' }).getAttribute('href')).toBe('/studio/build/app-1');
    });

    it('keeps the href of a link with a target app-absolute', () => {
        renderAt(
            '/store/objects',
            <NestedRouterProvider
                routes={[
                    {
                        path: '/objects',
                        Component: () => (
                            <NavLink href="/studio/build/app-1" target="_blank">
                                App
                            </NavLink>
                        ),
                    },
                ]}
            />,
        );

        expect(screen.getByRole('link', { name: 'App' }).getAttribute('href')).toBe('/studio/build/app-1');
    });

    it('follows the base path of a NestedNavigationContext, like useNavigate', () => {
        renderAt(
            '/store/objects/o1',
            <NestedRouterProvider
                routes={[
                    {
                        path: '/objects/*',
                        Component: () => (
                            <NestedNavigationContext basePath="/store" isBasePathNested={false}>
                                <NavLink href="/collections/c1">Collection</NavLink>
                            </NestedNavigationContext>
                        ),
                    },
                ]}
            />,
        );

        const link = screen.getByRole('link', { name: 'Collection' });
        expect(link.getAttribute('href')).toBe('/store/collections/c1');

        fireEvent.click(link);
        expect(window.location.pathname).toBe('/store/collections/c1');
    });

    it('keeps a click on a link with a target from a clickable ancestor', () => {
        const onRowClick = vi.fn();
        renderAt(
            '/store/objects',
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: test stand-in for a clickable table row.
            <div onClick={onRowClick}>
                <NavLink href="/store/executions/e1" target="_blank">
                    Execution
                </NavLink>
            </div>,
        );

        fireEvent.click(screen.getByRole('link', { name: 'Execution' }));

        expect(onRowClick).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/store/objects');
    });

    it('leaves a modified click to the browser and keeps it from a clickable ancestor', () => {
        const onRowClick = vi.fn();
        renderAt(
            '/store/objects',
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: test stand-in for a clickable table row.
            <div onClick={onRowClick}>
                <NavLink href="/store/objects/o1" topLevelNav>
                    Object
                </NavLink>
            </div>,
        );

        const link = screen.getByRole('link', { name: 'Object' });
        const notPrevented = fireEvent.click(link, { metaKey: true });

        expect(notPrevented).toBe(true);
        expect(onRowClick).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/store/objects');
    });
});
