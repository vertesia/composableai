import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DUPLICATE_REQUEST_REPORT_INTERVAL_MS,
    reportDuplicateRequest,
    resetDuplicateRequestReports,
} from './duplicateRequests';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@vertesia/ui/env', () => ({ Env: { logger: { warn } } }));

const duplicate = (path: string, shared = true) => ({ method: 'GET' as const, path, delayMs: 3, shared });

describe('reportDuplicateRequest', () => {
    afterEach(() => {
        resetDuplicateRequestReports();
        warn.mockClear();
    });

    it('warns once per path per interval and counts the duplicates in between', () => {
        reportDuplicateRequest(duplicate('https://api.example.test/api/v1/projects'), 0);
        reportDuplicateRequest(duplicate('https://api.example.test/api/v1/projects'), 10);
        reportDuplicateRequest(duplicate('https://api.example.test/api/v1/projects', false), 20);
        reportDuplicateRequest(duplicate('https://api.example.test/api/v1/agents/a1'), 30);
        expect(warn).toHaveBeenCalledTimes(2);

        reportDuplicateRequest(
            duplicate('https://api.example.test/api/v1/projects'),
            DUPLICATE_REQUEST_REPORT_INTERVAL_MS,
        );
        expect(warn).toHaveBeenCalledTimes(3);
        expect(warn).toHaveBeenLastCalledWith(expect.any(String), {
            duplicate_request: {
                method: 'GET',
                path: 'https://api.example.test/api/v1/projects',
                delay_ms: 3,
                shared: true,
                unreported_since_last: 2,
            },
        });
    });
});
