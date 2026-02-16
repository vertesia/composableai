import { type ReactNode, createContext, useCallback, useContext, useReducer } from 'react';

export type ScreenName =
    | 'home'
    | 'agent-list'
    | 'agent-config'
    | 'run-execution'
    | 'run-history'
    | 'run-detail'
    | 'documents'
    | 'skills'
    | 'prompt-editor'
    | 'analytics';

export interface ScreenState {
    name: ScreenName;
    params?: Record<string, unknown>;
}

interface NavigationContextValue {
    current: ScreenState;
    history: ScreenState[];
    navigate: (screen: ScreenName, params?: Record<string, unknown>) => void;
    goBack: () => void;
    canGoBack: boolean;
}

type NavAction =
    | { type: 'push'; screen: ScreenState }
    | { type: 'pop' };

interface NavState {
    stack: ScreenState[];
}

function navReducer(state: NavState, action: NavAction): NavState {
    switch (action.type) {
        case 'push':
            return { stack: [...state.stack, action.screen] };
        case 'pop':
            if (state.stack.length <= 1) return state;
            return { stack: state.stack.slice(0, -1) };
        default:
            return state;
    }
}

const NavigationContext = createContext<NavigationContextValue>({
    current: { name: 'home' },
    history: [],
    navigate: () => { /* default noop */ },
    goBack: () => { /* default noop */ },
    canGoBack: false,
});

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(navReducer, {
        stack: [{ name: 'home' as ScreenName }],
    });

    const navigate = useCallback((name: ScreenName, params?: Record<string, unknown>) => {
        dispatch({ type: 'push', screen: { name, params } });
    }, []);

    const goBack = useCallback(() => {
        dispatch({ type: 'pop' });
    }, []);

    const current = state.stack[state.stack.length - 1];

    return (
        <NavigationContext.Provider value={{
            current,
            history: state.stack,
            navigate,
            goBack,
            canGoBack: state.stack.length > 1,
        }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation(): NavigationContextValue {
    return useContext(NavigationContext);
}
