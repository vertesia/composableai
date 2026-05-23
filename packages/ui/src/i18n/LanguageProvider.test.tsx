/// <reference lib="dom" />
// @vitest-environment jsdom
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageProvider.js';
import type { SupportedLanguage } from './rtl.js';

// React 19's act() requires this flag to be set in test environments.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = 'vertesia-ui-language';

type LanguageSnapshot = {
    language: SupportedLanguage;
    isRTL: boolean;
    setLanguage: (next: SupportedLanguage) => void;
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(node: React.ReactNode) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    void act(() => {
        root?.render(node);
    });
}

describe('LanguageProvider', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.dir = '';
        document.documentElement.lang = '';
    });
    afterEach(() => {
        void act(() => {
            root?.unmount();
        });
        container?.remove();
        container = null;
        root = null;
        localStorage.clear();
    });

    it('falls back to defaultLanguage when nothing is stored', () => {
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider defaultLanguage="en">
                <Probe />
            </LanguageProvider>,
        );
        expect(snap.language).toBe('en');
        expect(snap.isRTL).toBe(false);
    });

    it('reads initial language from localStorage', () => {
        localStorage.setItem(STORAGE_KEY, 'ar');
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider>
                <Probe />
            </LanguageProvider>,
        );
        expect(snap.language).toBe('ar');
        expect(snap.isRTL).toBe(true);
    });

    it('resolves stored region-tagged language down to a supported base', () => {
        localStorage.setItem(STORAGE_KEY, 'pt-BR');
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider>
                <Probe />
            </LanguageProvider>,
        );
        expect(snap.language).toBe('pt');
    });

    it('preserves zh-TW exactly (does not collapse to zh)', () => {
        localStorage.setItem(STORAGE_KEY, 'zh-TW');
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider>
                <Probe />
            </LanguageProvider>,
        );
        expect(snap.language).toBe('zh-TW');
    });

    it('applies dir and lang to documentElement on mount and on change', () => {
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <StrictMode>
                <LanguageProvider defaultLanguage="en">
                    <Probe />
                </LanguageProvider>
            </StrictMode>,
        );
        expect(document.documentElement.dir).toBe('ltr');
        expect(document.documentElement.lang).toBe('en');

        void act(() => {
            snap.setLanguage('ar');
        });
        expect(document.documentElement.dir).toBe('rtl');
        expect(document.documentElement.lang).toBe('ar');

        void act(() => {
            snap.setLanguage('fr');
        });
        expect(document.documentElement.dir).toBe('ltr');
        expect(document.documentElement.lang).toBe('fr');
    });

    it('persists setLanguage calls to localStorage', () => {
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider>
                <Probe />
            </LanguageProvider>,
        );
        void act(() => {
            snap.setLanguage('ar');
        });
        expect(localStorage.getItem(STORAGE_KEY)).toBe('ar');
    });

    it('honors a custom storageKey', () => {
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider storageKey="custom-lang-key" defaultLanguage="en">
                <Probe />
            </LanguageProvider>,
        );
        void act(() => {
            snap.setLanguage('ar');
        });
        expect(localStorage.getItem('custom-lang-key')).toBe('ar');
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});

