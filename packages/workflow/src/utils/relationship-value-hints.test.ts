import { describe, expect, it, vi } from 'vitest';
import { loadRelationshipValueHints } from './relationship-value-hints.js';

describe('loadRelationshipValueHints', () => {
    it('does not call the API when value hints are disabled', async () => {
        const valueHints = vi.fn();
        expect(
            await loadRelationshipValueHints({ store: { relationships: { valueHints } } }, 'doc-1', undefined),
        ).toBeUndefined();
        expect(valueHints).not.toHaveBeenCalled();
    });

    it('passes effective caps and omits unrequested fields and excess values', async () => {
        const valueHints = vi.fn(async () => ({
            fields: [
                {
                    field: 'vendor',
                    values: [
                        { value: 'Acme', count: 3 },
                        { value: 'Other', count: 1 },
                    ],
                },
                { field: 'private', values: [{ value: 'Hidden', count: 9 }] },
            ],
            truncated: true,
            scanned_documents: 10,
        }));
        const config = { fields: ['vendor'], max_values_per_field: 1, max_total_values: 1 };
        const text = await loadRelationshipValueHints({ store: { relationships: { valueHints } } }, 'doc-1', config);
        expect(valueHints).toHaveBeenCalledWith({ document_id: 'doc-1', config });
        expect(text).toBe('vendor: "Acme" (3)');
    });

    it('propagates lookup errors so opt-in hints do not silently disappear', async () => {
        const valueHints = vi.fn(async () => {
            throw new Error('lookup failed');
        });
        await expect(
            loadRelationshipValueHints({ store: { relationships: { valueHints } } }, 'doc-1', { fields: ['vendor'] }),
        ).rejects.toThrow('lookup failed');
    });

    it('limits prompt text even when the response contains many long values', async () => {
        const valueHints = vi.fn(async () => ({
            fields: ['vendor', 'customer'].map((field) => ({
                field,
                values: Array.from({ length: 20 }, (_, index) => ({
                    value: `${index}-${'x'.repeat(490)}`,
                    count: 1,
                })),
            })),
            truncated: false,
            scanned_documents: 50,
        }));
        const text = await loadRelationshipValueHints({ store: { relationships: { valueHints } } }, 'doc-1', {
            fields: ['vendor', 'customer'],
            max_values_per_field: 50,
        });
        expect(text?.length).toBeLessThanOrEqual(12_000);
        expect(text).toContain('\ncustomer:');
        expect(text).not.toContain('customer: "19-');
    });
});
