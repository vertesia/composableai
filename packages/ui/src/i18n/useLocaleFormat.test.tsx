/// <reference lib="dom" />
// @vitest-environment happy-dom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from './LanguageProvider.js';
import type { SupportedLanguage } from './rtl.js';
import { useLocaleFormat, type LocaleFormat } from './useLocaleFormat.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(language: SupportedLanguage): LocaleFormat {
    // The provider reads localStorage > navigator.language > defaultLanguage,
    // so to force a language in tests we have to pin it via localStorage.
    localStorage.setItem('vertesia-ui-language', language);
    let snap!: LocaleFormat;
    function Probe() {
        snap = useLocaleFormat();
        return null;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
        root!.render(
            <LanguageProvider>
                <Probe />
            </LanguageProvider>,
        );
    });
    return snap;
}

describe('useLocaleFormat', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        act(() => {
            root?.unmount();
        });
        container?.remove();
        container = null;
        root = null;
    });

    it('exposes the active language code', () => {
        const fr = mount('fr');
        expect(fr.language).toBe('fr');
    });

    describe('formatDate / formatDateTime / formatTime', () => {
        // Use noon UTC so timezone offsets stay on the same calendar day across
        // every reasonable test environment.
        const sample = new Date(Date.UTC(2026, 4, 11, 12, 0, 0));

        it('renders dates in the active locale', () => {
            const en = mount('en');
            // Default style is `long` so en-US renders e.g. "May 11, 2026".
            expect(en.formatDate(sample)).toMatch(/May/);
            expect(en.formatDate(sample)).toMatch(/2026/);
        });

        it('uses 年月日 markers for Japanese', () => {
            const ja = mount('ja').formatDate(sample);
            expect(ja).toContain('年');
            expect(ja).toContain('月');
            expect(ja).toContain('日');
        });

        it('honors numberingSystem option for Arabic-Indic digits', () => {
            const ar = mount('ar').formatDate(sample, {
                dateStyle: 'short',
                numberingSystem: 'arab',
            });
            expect(ar).toMatch(/[٠-٩]/);
        });

        it('produces different output for different locales', () => {
            const en = mount('en').formatDateTime(sample);
            const ja = mount('ja').formatDateTime(sample);
            const ar = mount('ar').formatDateTime(sample);
            expect(en).not.toBe(ja);
            expect(en).not.toBe(ar);
            expect(ja).not.toBe(ar);
        });

        it('accepts Date / ISO string / epoch ms inputs', () => {
            const en = mount('en');
            const asDate = en.formatDate(sample);
            const asString = en.formatDate(sample.toISOString());
            const asNumber = en.formatDate(sample.getTime());
            expect(asDate).toBe(asString);
            expect(asDate).toBe(asNumber);
        });

        it('returns the placeholder for null / undefined / invalid', () => {
            const en = mount('en');
            expect(en.formatDate(null)).toBe('—');
            expect(en.formatDate(undefined)).toBe('—');
            expect(en.formatDate('not-a-date')).toBe('—');
            expect(en.formatDate(Number.NaN)).toBe('—');
        });

        it('honors custom DateTimeFormat options', () => {
            const en = mount('en');
            const full = en.formatDate(sample, { year: 'numeric', month: 'long', day: 'numeric' });
            expect(full).toMatch(/May/);
            expect(full).toMatch(/2026/);
        });
    });

    describe('formatNumber', () => {
        it('uses locale digits and separators', () => {
            const en = mount('en').formatNumber(1234567.89);
            const ja = mount('ja').formatNumber(1234567.89);
            expect(en).toMatch(/1,234,567/);
            // ja and en may share separators; assert they at least format the
            // same input as a string without throwing.
            expect(typeof ja).toBe('string');
            expect(ja.length).toBeGreaterThan(0);
        });

        it('honors numberingSystem option for Arabic-Indic digits', () => {
            const ar = mount('ar').formatNumber(42, { numberingSystem: 'arab' });
            expect(ar).toMatch(/[٠-٩]/);
        });

        it('returns the placeholder for null / NaN', () => {
            const en = mount('en');
            expect(en.formatNumber(null)).toBe('—');
            expect(en.formatNumber(Number.NaN)).toBe('—');
        });

        it('honors NumberFormat options like currency', () => {
            const en = mount('en').formatNumber(42, { style: 'currency', currency: 'USD' });
            expect(en).toMatch(/\$/);
            expect(en).toMatch(/42/);
        });
    });

    describe('formatRelativeTime', () => {
        it('produces a locale-specific relative phrase', () => {
            const en = mount('en');
            const future = new Date(Date.now() + 2 * 86400 * 1000); // +2 days
            const past = new Date(Date.now() - 2 * 86400 * 1000); // -2 days
            expect(en.formatRelativeTime(future)).toMatch(/2.*days?/);
            expect(en.formatRelativeTime(past)).toMatch(/2.*days? ago/);
        });

        it('returns the placeholder for invalid input', () => {
            const en = mount('en');
            expect(en.formatRelativeTime(null)).toBe('—');
            expect(en.formatRelativeTime('not-a-date')).toBe('—');
        });
    });

    describe('formatList', () => {
        it('joins items in locale-appropriate conjunction style', () => {
            const en = mount('en').formatList(['Alice', 'Bob', 'Carol']);
            expect(en).toMatch(/Alice/);
            expect(en).toMatch(/Bob/);
            expect(en).toMatch(/Carol/);
        });

        it('handles empty / null-filtered inputs', () => {
            const en = mount('en');
            expect(en.formatList([])).toBe('');
            expect(en.formatList(['', 'x', ''])).toBe('x');
        });
    });
});
