import { describe, expect, it } from 'vitest';
import { validateProjectSearchPropertyMappings } from './project.js';

describe('validateProjectSearchPropertyMappings', () => {
    it('accepts supported leaf mappings on relative property paths', () => {
        expect(
            validateProjectSearchPropertyMappings({
                order_total: { type: 'double', ignore_malformed: true },
                release_date: {
                    type: 'date',
                    format: 'strict_date_optional_time||yyyy-MM-dd',
                    ignore_malformed: true,
                },
                'customer.account_number': { type: 'keyword', ignore_above: 128 },
            }),
        ).toEqual([]);
    });

    it('rejects unsupported mapping options and types', () => {
        const issues = validateProjectSearchPropertyMappings({
            order_total: { type: 'scaled_float', scaling_factor: 100 },
            release_date: { type: 'keyword', format: 'yyyy-MM-dd' },
            customer: { type: 'keyword', ignore_malformed: true },
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.stringContaining('unsupported option(s): scaling_factor'),
                expect.stringContaining('type must be one of'),
                expect.stringContaining('format is supported only for date mappings'),
                expect.stringContaining('ignore_malformed is supported only for long, double, and date mappings'),
            ]),
        );
    });

    it('allows parent and child leaf mappings for subobjects:false indexes', () => {
        expect(
            validateProjectSearchPropertyMappings({
                customer: { type: 'keyword' },
                'customer.name': { type: 'keyword' },
            }),
        ).toEqual([]);
    });
});
