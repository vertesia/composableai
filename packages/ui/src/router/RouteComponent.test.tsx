import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prefetchLazyRoutes, RouteComponent } from './RouteComponent';
import { type LazyRouteModule, useNavigate } from './Router';
import { RouterProvider } from './RouterProvider';

/**
 * Lazy routes resolve their module asynchronously, which opens two windows for showing the wrong
 * page: reusing the state of the previous lazy route while the next import is in flight, and a
 * slower earlier import landing after a newer navigation already resolved. Both were real —
 * RouteComponent now remounts per path and drops stale module resolutions.
 */

function deferredModule(text: string) {
    let resolve!: (module: LazyRouteModule) => void;
    const promise = new Promise<LazyRouteModule>((r) => {
        resolve = r;
    });
    return {
        promise,
        resolve: () => resolve({ default: () => <div>{text}</div> }),
    };
}

let navigateFn: ReturnType<typeof useNavigate>;
function CaptureNavigate() {
    navigateFn = useNavigate();
    return null;
}

describe('RouteComponent lazy routes', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/a');
    });

    afterEach(() => {
        cleanup();
        window.history.pushState({}, '', '/');
    });

    it('stops showing the previous lazy route while the next one loads', async () => {
        const pageA = deferredModule('Page A');
        const pageB = deferredModule('Page B');
        const routes = [
            { path: '/a', LazyComponent: () => pageA.promise },
            { path: '/b', LazyComponent: () => pageB.promise },
        ];
        render(
            <RouterProvider routes={routes}>
                <CaptureNavigate />
                <RouteComponent spinner={<div>loading</div>} />
            </RouterProvider>,
        );
        await act(async () => pageA.resolve());
        await waitFor(() => expect(screen.getByText('Page A')).toBeDefined());

        await act(async () => navigateFn('/b'));
        // The old page must not linger while B's import is still pending.
        expect(screen.queryByText('Page A')).toBeNull();
        expect(screen.getByText('loading')).toBeDefined();

        await act(async () => pageB.resolve());
        await waitFor(() => expect(screen.getByText('Page B')).toBeDefined());
    });

    it('ignores a slow import that resolves after a newer navigation', async () => {
        const pageA = deferredModule('Page A');
        const pageB = deferredModule('Page B');
        const routes = [
            { path: '/a', LazyComponent: () => pageA.promise },
            { path: '/b', LazyComponent: () => pageB.promise },
        ];
        render(
            <RouterProvider routes={routes}>
                <CaptureNavigate />
                <RouteComponent />
            </RouterProvider>,
        );
        // Navigate away from /a before its import resolves.
        await act(async () => navigateFn('/b'));
        await act(async () => pageB.resolve());
        await waitFor(() => expect(screen.getByText('Page B')).toBeDefined());

        // A's import resolving late must not replace the current page.
        await act(async () => pageA.resolve());
        expect(screen.queryByText('Page A')).toBeNull();
        expect(screen.getByText('Page B')).toBeDefined();
    });

    it('renders a previously resolved lazy route synchronously on revisit', async () => {
        const pageA = deferredModule('Page A');
        const pageB = deferredModule('Page B');
        const routes = [
            { path: '/a', LazyComponent: () => pageA.promise },
            { path: '/b', LazyComponent: () => pageB.promise },
        ];
        render(
            <RouterProvider routes={routes}>
                <CaptureNavigate />
                <RouteComponent spinner={<div>loading</div>} />
            </RouterProvider>,
        );
        await act(async () => pageA.resolve());
        await waitFor(() => expect(screen.getByText('Page A')).toBeDefined());
        await act(async () => navigateFn('/b'));
        await act(async () => pageB.resolve());
        await waitFor(() => expect(screen.getByText('Page B')).toBeDefined());

        // Back to /a: its module is cached, so not even one spinner frame may show.
        act(() => navigateFn('/a'));
        expect(screen.getByText('Page A')).toBeDefined();
        expect(screen.queryByText('loading')).toBeNull();
    });

    it('prefetched lazy routes render without a spinner on first navigation', async () => {
        const pageA = deferredModule('Page A');
        const pageB = deferredModule('Page B');
        const routes = [
            { path: '/a', LazyComponent: () => pageA.promise },
            { path: '/b', LazyComponent: () => pageB.promise },
            { path: '/c', Component: () => <div>Page C</div> },
        ];
        pageA.resolve();
        pageB.resolve();
        await prefetchLazyRoutes(routes);

        render(
            <RouterProvider routes={routes}>
                <CaptureNavigate />
                <RouteComponent spinner={<div>loading</div>} />
            </RouterProvider>,
        );
        // Even the initial mount renders from the prefetch cache.
        expect(screen.getByText('Page A')).toBeDefined();
        act(() => navigateFn('/b'));
        expect(screen.getByText('Page B')).toBeDefined();
        expect(screen.queryByText('loading')).toBeNull();
    });
});
