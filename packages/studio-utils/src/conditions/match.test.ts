import { describe, expect, it, vi } from 'vitest';
import { installStudioUtilsLogger, type StudioUtilsLogger } from '../logger.js';
import { matchConditions, matchLike, resolveConditions, resolvePath } from './index.js';

describe('resolvePath', () => {
    it('resolves top-level fields and one-level properties fields', () => {
        const value = {
            clearance: 3,
            properties: {
                department: 'engineering',
            },
        };

        expect(resolvePath(value, 'clearance')).toBe(3);
        expect(resolvePath(value, 'properties.department')).toBe('engineering');
        expect(resolvePath(value, 'properties.missing')).toBeUndefined();
        expect(resolvePath({ clearance: 3 }, 'properties.department')).toBeUndefined();
    });
});

describe('matchLike', () => {
    it('matches wildcard string patterns case-insensitively', () => {
        expect(matchLike('bogdan+test@vertesiahq.com', '*+test*@VERTESIAHQ.COM')).toBe(true);
        expect(matchLike('bogdan@gmail.com', '*@vertesiahq.com')).toBe(false);
        expect(matchLike(42, '*')).toBe(false);
    });
});

describe('matchConditions', () => {
    it('matches direct values and operator objects', () => {
        const properties = {
            active: true,
            clearance: 5,
            compartments: ['engineering'],
            email: 'bogdan@vertesiahq.com',
            properties: {
                department: 'engineering',
            },
        };

        expect(
            matchConditions(
                {
                    active: true,
                    clearance: { $gte: 3, $lte: 5 },
                    compartments: { $empty: false },
                    email: { $like: '*@vertesiahq.com' },
                    'properties.department': { $in: ['engineering', 'product'] },
                },
                properties,
            ),
        ).toBe(true);
    });

    it('requires ordered comparisons to use matching primitive types', () => {
        expect(matchConditions({ clearance: { $gt: 3 } }, { clearance: 5 })).toBe(true);
        expect(matchConditions({ clearance: { $gt: 3 } }, { clearance: '5' })).toBe(false);
        expect(matchConditions({ code: { $gt: 'a' } }, { code: 'b' })).toBe(true);
    });

    it('matches set operators against scalar and array-valued object fields', () => {
        expect(
            matchConditions({ compartments: { $in: ['finance', 'legal'] } }, { compartments: ['hr', 'finance'] }),
        ).toBe(true);
        expect(matchConditions({ compartments: { $in: ['finance'] } }, { compartments: ['hr'] })).toBe(false);
        expect(matchConditions({ compartments: { $nin: ['finance'] } }, { compartments: ['hr'] })).toBe(true);
        expect(matchConditions({ compartments: { $nin: ['finance'] } }, { compartments: ['hr', 'finance'] })).toBe(
            false,
        );
    });

    it('uses Mongo-compatible equality for scalar conditions on array-valued fields', () => {
        expect(matchConditions({ tags: 'finance' }, { tags: ['audit', 'finance'] })).toBe(true);
        expect(matchConditions({ tags: { $eq: 'finance' } }, { tags: ['audit', 'finance'] })).toBe(true);
        expect(matchConditions({ tags: { $ne: 'finance' } }, { tags: ['audit', 'finance'] })).toBe(false);
    });

    it('treats unknown operators as non-matches', () => {
        const logger: StudioUtilsLogger = {
            warn: vi.fn(),
        };
        const previousLogger = installStudioUtilsLogger(logger);

        expect(matchConditions({ clearance: { $unknown: 3 } }, { clearance: 5 })).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
            { op: '$unknown', key: 'clearance' },
            'Unknown operator in PropertyConditions',
        );

        installStudioUtilsLogger(previousLogger);
    });
});

describe('resolveConditions', () => {
    it('resolves scalar and array principal references', () => {
        expect(
            resolveConditions(
                {
                    sensitivity: { $lte: '$principal.clearance' },
                    compartments: { $in: '$principal.compartments' },
                    'properties.department': '$principal.properties.department',
                },
                {
                    clearance: 3,
                    compartments: ['finance'],
                    properties: { department: 'finance' },
                },
            ),
        ).toEqual({
            sensitivity: { $lte: 3 },
            compartments: { $in: ['finance'] },
            'properties.department': 'finance',
        });
    });

    it('uses deterministic defaults for missing principal fields', () => {
        expect(
            resolveConditions(
                {
                    sensitivity: { $lte: '$principal.clearance' },
                    compartments: { $in: '$principal.compartments' },
                    active: { $exists: '$principal.active' },
                    department: '$principal.properties.department',
                },
                {},
            ),
        ).toEqual({
            sensitivity: { $lte: 0 },
            compartments: { $in: [] },
            active: { $exists: false },
            department: '',
        });
    });
});
