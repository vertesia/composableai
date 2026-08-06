import { useEffect } from 'react';
import type { NavigateOptions } from './HistoryNavigator';
import { useNavigate } from './Router';

export interface RedirectProps {
    to: string;
    replace?: boolean;
    state?: unknown;
}

export function Redirect({ to, replace = true, state }: RedirectProps) {
    const navigate = useNavigate();

    useEffect(() => {
        navigate(to, { replace, state });
    }, [navigate, replace, state, to]);

    return null;
}

/**
 * Creates a route component that redirects to another route when rendered.
 * Useful in route tables, for example: `{ path: '/', Component: redirectTo('/content') }`.
 */
export function redirectTo(to: string, options: Pick<NavigateOptions, 'replace' | 'state'> = {}) {
    return function RedirectRoute() {
        return <Redirect to={to} replace={options.replace} state={options.state} />;
    };
}
