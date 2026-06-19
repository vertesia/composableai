import { describe, expect, test } from 'vitest';
import { createPathMatcherUnsafe } from './path-matchers.js';

function expectParams(result: unknown, expected: Record<string, string | string[]>): void {
    expect(result).not.toBe(false);
    expect({ ...(result as { params: Record<string, string | string[]> }).params }).toEqual(expected);
}

describe('createPathMatcherUnsafe', () => {
    test('supports legacy named one-or-more splat params with path-to-regexp v8', () => {
        const matcher = createPathMatcherUnsafe('/:agentRunId/artifacts/:path+');

        expectParams(matcher('/run-1/artifacts/nested/report.txt'), {
            agentRunId: 'run-1',
            path: ['nested', 'report.txt'],
        });
        expect(matcher('/run-1/artifacts')).toBe(false);
    });

    test('supports legacy named zero-or-more splat params with path-to-regexp v8', () => {
        const matcher = createPathMatcherUnsafe('/:path*');

        expectParams(matcher('/nested/report.txt'), {
            path: ['nested', 'report.txt'],
        });
        expectParams(matcher('/'), {});
    });
});
