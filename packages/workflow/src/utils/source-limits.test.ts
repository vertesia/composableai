import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CONVERTER_MAX_SOURCE_MB_ENV,
    getSourceLimits,
    MEDIA_MAX_SOURCE_MB_ENV,
    OFFICE_MAX_PARSED_MB_ENV,
    OFFICE_MAX_UNPACKED_MB_ENV,
} from './source-limits.js';

const MiB = 1024 * 1024;

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('getSourceLimits', () => {
    it('defaults to 1 GiB for converters, 100 MiB parsed and 512 MiB unpacked for Office documents, 8 GiB for media', () => {
        vi.stubEnv(CONVERTER_MAX_SOURCE_MB_ENV, '');
        vi.stubEnv(OFFICE_MAX_PARSED_MB_ENV, '');
        vi.stubEnv(OFFICE_MAX_UNPACKED_MB_ENV, '');
        vi.stubEnv(MEDIA_MAX_SOURCE_MB_ENV, '');
        expect(getSourceLimits()).toEqual({
            converterMaxBytes: 1024 * MiB,
            officeMaxParsedBytes: 100 * MiB,
            officeMaxUnpackedBytes: 512 * MiB,
            mediaMaxBytes: 8192 * MiB,
        });
    });

    it('reads each limit from its environment variable', () => {
        vi.stubEnv(CONVERTER_MAX_SOURCE_MB_ENV, ' 2048 ');
        vi.stubEnv(OFFICE_MAX_PARSED_MB_ENV, '50');
        vi.stubEnv(OFFICE_MAX_UNPACKED_MB_ENV, '256');
        vi.stubEnv(MEDIA_MAX_SOURCE_MB_ENV, '4096');
        expect(getSourceLimits()).toEqual({
            converterMaxBytes: 2048 * MiB,
            officeMaxParsedBytes: 50 * MiB,
            officeMaxUnpackedBytes: 256 * MiB,
            mediaMaxBytes: 4096 * MiB,
        });
    });

    it.each(['0', '-1', '1.5', '2GB', 'abc', '1e3'])('keeps the default for "%s"', (raw) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.stubEnv(MEDIA_MAX_SOURCE_MB_ENV, raw);
        expect(getSourceLimits().mediaMaxBytes).toBe(8192 * MiB);
        expect(warn).toHaveBeenCalledOnce();
    });
});
