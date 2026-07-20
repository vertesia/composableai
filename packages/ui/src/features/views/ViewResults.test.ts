import { ContentObjectStatus, type ViewHit } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { formatViewFieldValue, getViewFieldValue } from './ViewResults.js';

const hit: ViewHit = {
    id: 'doc-1',
    score: 1.25,
    annotation: { why_match: 'Matches the renewal clause.' },
    document: {
        id: 'doc-1',
        name: 'Contract',
        description: 'Example',
        created_at: '2026-01-01T00:00:00.000Z',
        created_by: 'user-1',
        updated_at: '2026-02-01T00:00:00.000Z',
        updated_by: 'user-1',
        location: '/Customers/Acme',
        status: ContentObjectStatus.completed,
        properties: { brand: 'Acme', size: 2500, parties: ['Acme', 'Vertesia'] },
        revision: { root: 'doc-1', head: true },
    },
};

describe('View result fields', () => {
    it('reads document, annotation, and score fields', () => {
        expect(getViewFieldValue(hit, 'properties.brand')).toBe('Acme');
        expect(getViewFieldValue(hit, 'annotation.why_match')).toBe('Matches the renewal clause.');
        expect(getViewFieldValue(hit, 'score')).toBe(1.25);
    });

    it('formats arrays, numbers, and fallbacks', () => {
        expect(formatViewFieldValue(hit, { field: 'properties.parties' })).toBe('Acme, Vertesia');
        expect(formatViewFieldValue(hit, { field: 'properties.size', format: 'number' })).toBe('2,500');
        expect(formatViewFieldValue(hit, { field: 'properties.missing', fallback: 'Unknown' })).toBe('Unknown');
    });

    it('renders date-only values as calendar dates independent of the client time zone', () => {
        const dateOnlyHit = {
            ...hit,
            document: {
                ...hit.document,
                properties: { ...hit.document.properties, release_date: '2026-01-01' },
            },
        };
        const expected = new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' }).format(
            new Date('2026-01-01T00:00:00.000Z'),
        );

        expect(formatViewFieldValue(dateOnlyHit, { field: 'properties.release_date', format: 'date' })).toBe(expected);
    });

    it('uses the active locale formatters supplied by the View renderer', () => {
        const formatDate = (date: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) =>
            new Intl.DateTimeFormat('fr', options).format(new Date(date ?? 0));
        const formatNumber = (value: number | null | undefined) =>
            value === null || value === undefined ? '—' : new Intl.NumberFormat('fr').format(value);

        expect(
            formatViewFieldValue(hit, { field: 'properties.size', format: 'number' }, { formatDate, formatNumber }),
        ).toBe(new Intl.NumberFormat('fr').format(2500));
        expect(
            formatViewFieldValue(
                {
                    ...hit,
                    document: {
                        ...hit.document,
                        properties: { ...hit.document.properties, release_date: '2026-01-01' },
                    },
                },
                { field: 'properties.release_date', format: 'date' },
                { formatDate, formatNumber },
            ),
        ).toBe(
            new Intl.DateTimeFormat('fr', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                timeZone: 'UTC',
            }).format(new Date('2026-01-01T00:00:00.000Z')),
        );
    });
});
