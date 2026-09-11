import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countTokens, truncByMaxTokens } from './tokens.js';

const mocks = vi.hoisted(() => ({
    getEncoding: vi.fn(),
}));

vi.mock('tiktoken', () => ({
    get_encoding: mocks.getEncoding,
}));

function mockEncoder() {
    return {
        encode: vi.fn().mockReturnValue(new Uint32Array([1, 2, 3])),
        decode: vi.fn().mockReturnValue(new TextEncoder().encode('truncated')),
        free: vi.fn(),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('truncByMaxTokens', () => {
    it('releases its encoder after truncating content', () => {
        const encoder = mockEncoder();
        mocks.getEncoding.mockReturnValue(encoder);

        expect(truncByMaxTokens('original', 2)).toBe('truncated');
        expect(encoder.decode).toHaveBeenCalledWith(new Uint32Array([1, 2]));
        expect(encoder.free).toHaveBeenCalledOnce();
    });

    it('releases its encoder when encoding fails', () => {
        const encoder = mockEncoder();
        encoder.encode.mockImplementation(() => {
            throw new Error('encode failed');
        });
        mocks.getEncoding.mockReturnValue(encoder);

        expect(() => truncByMaxTokens('original', 2)).toThrow('encode failed');
        expect(encoder.free).toHaveBeenCalledOnce();
    });
});

describe('countTokens', () => {
    it('returns the existing result shape and releases its encoder', () => {
        const encoder = mockEncoder();
        mocks.getEncoding.mockReturnValue(encoder);

        expect(countTokens('content')).toEqual({ count: 3, encoding: 'cl100k_base' });
        expect(encoder.free).toHaveBeenCalledOnce();
    });

    it('releases its encoder when encoding fails', () => {
        const encoder = mockEncoder();
        encoder.encode.mockImplementation(() => {
            throw new Error('encode failed');
        });
        mocks.getEncoding.mockReturnValue(encoder);

        expect(() => countTokens('content')).toThrow('encode failed');
        expect(encoder.free).toHaveBeenCalledOnce();
    });
});
