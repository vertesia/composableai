import { DirectionProvider } from '@radix-ui/react-direction';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isRTL, resolveLanguage, type SupportedLanguage } from './rtl.js';

type LanguageProviderProps = {
    children: React.ReactNode;
    defaultLanguage?: SupportedLanguage;
    storageKey?: string;
};

type LanguageProviderState = {
    language: SupportedLanguage;
    setLanguage: (language: SupportedLanguage) => void;
    isRTL: boolean;
};

const initialState: LanguageProviderState = {
    language: 'en',
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
    storageKey = 'vertesia-ui-language',
    ...props
}: LanguageProviderProps) {
    const [language, setLanguage] = useState<SupportedLanguage>(() => readInitialLanguage(storageKey, defaultLanguage));

    const rtl = isRTL(language);

    useEffect(() => {
        const root = window.document.documentElement;
        root.lang = language;
        root.dir = rtl ? 'rtl' : 'ltr';
    }, [language, rtl]);

    const value = useMemo<LanguageProviderState>(
        () => ({
            language,
            isRTL: rtl,
            setLanguage: (next: SupportedLanguage) => {
                window.localStorage?.setItem(storageKey, next);
                setLanguage(next);
            },
        }),
        [language, rtl, storageKey],
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
