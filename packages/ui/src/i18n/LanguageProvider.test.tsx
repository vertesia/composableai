/// <reference lib="dom" />
// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageProvider.js';
import type { SupportedLanguage } from './rtl.js';

// React 19's act() requires this flag to be set in test environments.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = 'vertesia-ui-language';

type LanguageSnapshot = {
    language: SupportedLanguage;
    preferredLanguage: SupportedLanguage;
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

    it("renders a pinned language while tracking the user's own", () => {
        localStorage.setItem(STORAGE_KEY, 'ja');
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider language="en">
                <Probe />
            </LanguageProvider>,
        );
        expect(snap.language).toBe('en');
        expect(snap.preferredLanguage).toBe('ja');
        expect(document.documentElement.lang).toBe('en');
    });

    it('keeps a pinned right-to-left language right to left whatever the user prefers', () => {
        localStorage.setItem(STORAGE_KEY, 'fr');
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider language="ar">
                <Probe />
            </LanguageProvider>,
        );
        expect(snap.isRTL).toBe(true);
        expect(document.documentElement.dir).toBe('rtl');
    });

    it('records a new choice under a pinned language without changing what renders', () => {
        let snap!: LanguageSnapshot;
        function Probe() {
            snap = useLanguage();
            return null;
        }
        mount(
            <LanguageProvider language="en">
                <Probe />
            </LanguageProvider>,
        );
        void act(() => {
            snap.setLanguage('de');
        });
        expect(snap.language).toBe('en');
        expect(snap.preferredLanguage).toBe('de');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
    });

    it('reports the rendered language as preferred when nothing is pinned', () => {
        localStorage.setItem(STORAGE_KEY, 'ko');
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
        expect(snap.language).toBe('ko');
        expect(snap.preferredLanguage).toBe('ko');
    });
});
