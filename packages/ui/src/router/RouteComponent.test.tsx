import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ErrorBoundary } from 'react-error-boundary';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    it.each(['missing module', 'rejected import', 'synchronous failure'] as const)(
        'reports a %s through the error boundary instead of remaining on the spinner',
        async (failure) => {
            const error = new Error('Module could not be loaded');
            const onError = vi.fn();
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const routes = [
                {
                    path: '/a',
                    LazyComponent: () => {
                        if (failure === 'synchronous failure') throw error;
                        return failure === 'missing module'
                            ? Promise.resolve(undefined as unknown as LazyRouteModule)
                            : Promise.reject(error);
                    },
                },
            ];
            try {
                render(
                    <ErrorBoundary fallback={<div>Route unavailable</div>} onError={onError}>
                        <RouterProvider routes={routes}>
                            <RouteComponent spinner={<div>loading</div>} />
                        </RouterProvider>
                    </ErrorBoundary>,
                );
                await screen.findByText('Route unavailable');
                expect(screen.queryByText('loading')).toBeNull();
                expect(onError.mock.calls[0][0]).toEqual(
                    failure === 'missing module'
                        ? new Error('Lazy module for /a does not have a default export')
                        : error,
                );
            } finally {
                consoleError.mockRestore();
            }
        },
    );

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

    it('ignores a rejected import after navigating away', async () => {
        let reject!: (error: Error) => void;
        const promise = new Promise<LazyRouteModule>((_resolve, rejectPromise) => {
            reject = rejectPromise;
        });
        const onError = vi.fn();
        render(
            <ErrorBoundary fallback={<div>Route unavailable</div>} onError={onError}>
                <RouterProvider
                    routes={[
                        { path: '/a', LazyComponent: () => promise },
                        { path: '/b', Component: () => <div>Page B</div> },
                    ]}
                >
                    <CaptureNavigate />
                    <RouteComponent />
                </RouterProvider>
            </ErrorBoundary>,
        );
        await act(async () => navigateFn('/b'));
        await act(async () => reject(new Error('Previous route failed')));
        expect(screen.getByText('Page B')).toBeDefined();
        expect(onError).not.toHaveBeenCalled();
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
