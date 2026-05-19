import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider.js';

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
    if (input == null) return null;
    const d = input instanceof Date ? input : new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Locale-aware formatters bound to the active language. Use these instead of
 * `.toLocaleString()` / `.toLocaleDateString()` so dates and numbers respect
 * the user's chosen UI language (and switch between Latin/Arabic-Indic
 * numerals, 12h/24h clocks, day/month ordering, etc.) rather than picking up
 * whatever the browser default happens to be.
 *
 * All formatters return `'—'` for null / undefined / invalid inputs.
 */
export interface LocaleFormat {
    /** Active language code (e.g. `'en'`, `'ar'`, `'zh-TW'`). */
    language: string;
    /** Date only, locale-appropriate short form by default. */
    formatDate: (date: DateInput, options?: Intl.DateTimeFormatOptions) => string;
    /** Date + time, short forms by default. */
    formatDateTime: (date: DateInput, options?: Intl.DateTimeFormatOptions) => string;
    /** Time only, short form by default. */
    formatTime: (date: DateInput, options?: Intl.DateTimeFormatOptions) => string;
    /** Number, with locale-appropriate digits, separators, and grouping. */
    formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
    /** Relative time like "in 2 hours" or "yesterday". */
    formatRelativeTime: (date: DateInput, options?: Intl.RelativeTimeFormatOptions) => string;
    /** List of strings, locale-appropriate conjunction ("a, b, and c"). */
    formatList: (items: string[], options?: Intl.ListFormatOptions) => string;
}

const PLACEHOLDER = '—';

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year',   seconds: 31536000 },
    { unit: 'month',  seconds: 2628000 },
    { unit: 'week',   seconds: 604800 },
    { unit: 'day',    seconds: 86400 },
    { unit: 'hour',   seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
];

export function useLocaleFormat(): LocaleFormat {
    const { language } = useLanguage();

    return useMemo<LocaleFormat>(() => {
        // dateStyle: 'long' so each locale shows its native flavor — Japanese
        // gets 年月日 markers, English gets "May 11, 2026", Arabic gets month
        // names, etc. The 'short' style is too aggressively numeric (it
        // renders Japanese as "2026/05/11", which is correct per CLDR but
        // doesn't feel localized to users). Call sites that want compact
        // numeric output can pass `{ dateStyle: 'short' }` explicitly.
        const dateLong = new Intl.DateTimeFormat(language, { dateStyle: 'long' });
        const dateTimeLong = new Intl.DateTimeFormat(language, { dateStyle: 'long', timeStyle: 'short' });
        const timeShort = new Intl.DateTimeFormat(language, { timeStyle: 'short' });
        const numberDefault = new Intl.NumberFormat(language);
        const relativeDefault = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
        const listDefault = new Intl.ListFormat(language);

        return {
            language,
            formatDate: (date, options) => {
                const d = toDate(date);
                if (!d) return PLACEHOLDER;
                return options ? new Intl.DateTimeFormat(language, options).format(d) : dateLong.format(d);
            },
            formatDateTime: (date, options) => {
                const d = toDate(date);
                if (!d) return PLACEHOLDER;
                return options ? new Intl.DateTimeFormat(language, options).format(d) : dateTimeLong.format(d);
            },
            formatTime: (date, options) => {
                const d = toDate(date);
                if (!d) return PLACEHOLDER;
                return options ? new Intl.DateTimeFormat(language, options).format(d) : timeShort.format(d);
            },
            formatNumber: (value, options) => {
                if (value == null || Number.isNaN(value)) return PLACEHOLDER;
                return options ? new Intl.NumberFormat(language, options).format(value) : numberDefault.format(value);
            },
            formatRelativeTime: (date, options) => {
                const d = toDate(date);
                if (!d) return PLACEHOLDER;
                const diffSeconds = (d.getTime() - Date.now()) / 1000;
                const abs = Math.abs(diffSeconds);
                const { unit, seconds } = RELATIVE_UNITS.find((u) => abs >= u.seconds) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
                const value = Math.round(diffSeconds / seconds);
                const formatter = options ? new Intl.RelativeTimeFormat(language, options) : relativeDefault;
                return formatter.format(value, unit);
            },
            formatList: (items, options) => {
                const filtered = items.filter((v) => v != null && v !== '');
                if (filtered.length === 0) return '';
                return options ? new Intl.ListFormat(language, options).format(filtered) : listDefault.format(filtered);
            },
        };
    }, [language]);
}
