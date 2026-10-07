import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme, options?: { persist?: boolean }) => void;
};

const initialState: ThemeProviderState = {
    theme: 'system',
    setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export { ThemeProviderContext };

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = 'vite-ui-theme',
    ...props
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(storageKey) as Theme) || defaultTheme);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme !== 'system') {
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
            return;
        }
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = () => {
            root.classList.remove('light', 'dark');
            root.classList.add(media.matches ? 'dark' : 'light');
        };
        applyTheme();
        media.addEventListener('change', applyTheme);
        return () => media.removeEventListener('change', applyTheme);
    }, [theme]);

    useEffect(() => {
        const syncStoredTheme = (event: StorageEvent) => {
            if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return;
            const value = event.newValue;
            setThemeState(value === 'dark' || value === 'light' || value === 'system' ? value : defaultTheme);
        };
        window.addEventListener('storage', syncStoredTheme);
        return () => window.removeEventListener('storage', syncStoredTheme);
    }, [defaultTheme, storageKey]);

    const setTheme = useCallback(
        (nextTheme: Theme, options?: { persist?: boolean }) => {
            if (options?.persist !== false) localStorage.setItem(storageKey, nextTheme);
            setThemeState(nextTheme);
        },
        [storageKey],
    );
    const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};
