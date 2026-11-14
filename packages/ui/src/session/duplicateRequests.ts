import type { DuplicateRequest } from '@vertesia/client';
import { Env } from '@vertesia/ui/env';

/** Report each request path at most once per interval, counting the duplicates in between. */
export const DUPLICATE_REQUEST_REPORT_INTERVAL_MS = 60_000;
const MAX_TRACKED_PATHS = 500;

const lastReports = new Map<string, { at: number; unreported: number }>();

/**
 * Logs a warning when an identical GET starts while another is in flight, so callers that load the same resource
 * separately can be found and made to share it. Rate-limited per path so a busy page cannot flood the log.
 */
export function reportDuplicateRequest(duplicate: DuplicateRequest, now = Date.now()): void {
    const last = lastReports.get(duplicate.path);
    if (last && now - last.at < DUPLICATE_REQUEST_REPORT_INTERVAL_MS) {
        last.unreported++;
        return;
    }
    if (!last && lastReports.size >= MAX_TRACKED_PATHS) lastReports.clear();
    lastReports.set(duplicate.path, { at: now, unreported: 0 });
    Env.logger.warn('Duplicate API request started while an identical one was in flight', {
        duplicate_request: {
            method: duplicate.method,
            path: duplicate.path,
            delay_ms: duplicate.delayMs,
            shared: duplicate.shared,
            // Duplicates of this path since its previous report, which were not logged.
            unreported_since_last: last?.unreported ?? 0,
        },
    });
}

/** For tests. */
export function resetDuplicateRequestReports(): void {
    lastReports.clear();
}
