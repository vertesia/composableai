/**
 * Tests for raw transformer
 */

import { describe, expect, it } from 'vitest';
import { rawTransformer } from '../src/core/transformers/raw.js';

describe('Raw Transformer', () => {
    it('should return content as-is', async () => {
        const content = 'This is raw content\nWith multiple lines';
        const result = await rawTransformer.transform(content, 'test.txt');

        expect(result.data).toBe(content);
    });

    it('should handle special characters', async () => {
        const content = 'Special chars: @#$%^&*()[]{}';
        const result = await rawTransformer.transform(content, 'test.txt');

        expect(result.data).toBe(content);
    });

    it('should handle empty content', async () => {
        const content = '';
        const result = await rawTransformer.transform(content, 'test.txt');

        expect(result.data).toBe('');
    });
});
