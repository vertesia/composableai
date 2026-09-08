// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NestedNavigationContext } from './NestedNavigationContext';
import { NestedRouterProvider } from './NestedRouterProvider';
import { RouteComponent } from './RouteComponent';
import { useNavigate } from './Router';
import { RouterProvider } from './RouterProvider';

function NavigationButton() {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate('/objects/object-1')}>
            Open object
        </button>
    );
}

describe('NestedNavigationContext', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/store/objects');
    });

    afterEach(() => {
        cleanup();
        window.history.pushState({}, '', '/');
    });

    it('can apply a top-level base path from inside a nested route', () => {
        const routes = [
            {
                path: '/store/objects/*',
                Component: () => (
                    <NestedRouterProvider routes={[{ path: '/', Component: () => null }]}>
                        <NestedNavigationContext basePath="/store" isBasePathNested={false}>
                            <NavigationButton />
                        </NestedNavigationContext>
                    </NestedRouterProvider>
                ),
            },
        ];

        render(
            <RouterProvider routes={routes}>
                <RouteComponent />
            </RouterProvider>,
        );

        act(() => fireEvent.click(screen.getByRole('button', { name: 'Open object' })));

        expect(window.location.pathname).toBe('/store/objects/object-1');
    });
});
