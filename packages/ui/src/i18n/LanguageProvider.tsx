import { DirectionProvider } from '@radix-ui/react-direction';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isRTL, LANGUAGE_STORAGE_KEY, resolveLanguage, type SupportedLanguage } from './rtl.js';

type LanguageProviderProps = {
    children: React.ReactNode;
    defaultLanguage?: SupportedLanguage;
    /**
     * Pin the language this app renders in, whatever the saved choice or browser language. The
     * user's own language is still tracked, and exposed as `preferredLanguage`.
     */
    language?: SupportedLanguage;
    storageKey?: string;
};

type LanguageProviderState = {
    /** The language the app renders in. */
    language: SupportedLanguage;
    /** The user's own language (saved choice, then browser); equals `language` unless pinned. */
    preferredLanguage: SupportedLanguage;
    setLanguage: (language: SupportedLanguage, options?: { persist?: boolean }) => void;
    isRTL: boolean;
};

const initialState: LanguageProviderState = {
    language: 'en',
    preferredLanguage: 'en',
    setLanguage: () => null,
    isRTL: false,
};

const LanguageProviderContext = createContext<LanguageProviderState>(initialState);

export { LanguageProviderContext };

function readInitialLanguage(storageKey: string, defaultLanguage: SupportedLanguage): SupportedLanguage {
    if (typeof window === 'undefined') return defaultLanguage;
    const stored = window.localStorage?.getItem(storageKey);
    if (stored) return resolveLanguage(stored);
    const nav = window.navigator?.language;
    if (nav) return resolveLanguage(nav);
    return defaultLanguage;
}

export function LanguageProvider({
    children,
    defaultLanguage = 'en',
    language: pinnedLanguage,
    storageKey = LANGUAGE_STORAGE_KEY,
    ...props
}: LanguageProviderProps) {
    const [preferredLanguage, setLanguageState] = useState<SupportedLanguage>(() =>
        readInitialLanguage(storageKey, defaultLanguage),
    );
    const language = pinnedLanguage ?? preferredLanguage;

    const rtl = isRTL(language);

    useEffect(() => {
        const root = window.document.documentElement;
        root.lang = language;
        root.dir = rtl ? 'rtl' : 'ltr';
    }, [language, rtl]);

    const setLanguage = useCallback(
        (next: SupportedLanguage, options?: { persist?: boolean }) => {
            if (options?.persist !== false) window.localStorage?.setItem(storageKey, next);
            setLanguageState(next);
        },
        [storageKey],
    );

    const value = useMemo<LanguageProviderState>(
        () => ({
            language,
            preferredLanguage,
            isRTL: rtl,
            setLanguage,
        }),
        [language, preferredLanguage, rtl, setLanguage],
    );

    return (
        <LanguageProviderContext.Provider {...props} value={value}>
            <DirectionProvider dir={rtl ? 'rtl' : 'ltr'}>{children}</DirectionProvider>
        </LanguageProviderContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageProviderContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
