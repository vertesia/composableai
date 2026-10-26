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

    test('answers 400 for a malformed percent-encoded param', () => {
        const matcher = createPathMatcherUnsafe('/resolve/:nameOrId');

        expectParams(matcher('/resolve/a%40v1'), { nameOrId: 'a@v1' });
        expect(() => matcher('/resolve/%E0%A4%A')).toThrow(expect.objectContaining({ statusCode: 400, expose: true }));
        // The caller's segment stays out of the exposed message.
        expect(() => matcher('/resolve/%3Csvg%3E%E0')).toThrow('Malformed percent-encoding in URL path');
        expect(() => matcher('/resolve/%3Csvg%3E%E0')).not.toThrow(/svg/);
    });
});
