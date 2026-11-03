import { Context } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import type { Project } from '@vertesia/common';

/**
 * Per-process cache of projects, keyed by project ID.
 *
 * Activities read slow-moving project settings (`project.configuration`) on almost every run. Without a
 * process-wide cache, each activity fetches the project from the API again. A cached project is served for
 * {@link PROJECT_CACHE_TTL_MS}, so a configuration change reaches the workers within that delay.
 *
 * Concurrent misses for the same project share one fetch, made with the client of the caller that started
 * it. A failed fetch is never cached: the error reaches every caller waiting on it, and the next call fetches
 * again. The exception is a cancellation: an activity's client aborts its requests when that activity is
 * cancelled, so when the caller that started a shared fetch is cancelled, the other callers fetch again with
 * their own client instead of failing. Each caller's own cancellation ends only its own wait.
 */
export const PROJECT_CACHE_TTL_MS = 60_000;

/** Above this size, a new entry first evicts the expired ones, so projects no longer used do not pile up. */
const SWEEP_THRESHOLD = 500;

interface CacheEntry {
    project: Project;
    expiresAtMs: number;
}

interface PendingFetch {
    promise: Promise<Project>;
    /** Cancellation signal of the caller whose client makes the fetch. */
    signal?: AbortSignal;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, PendingFetch>();

/**
 * Get a project from the per-process cache, fetching it with `client` on a miss or after expiry.
 * Each caller gets its own copy, so a caller that mutates the result does not change what others read.
 *
 * @param signal the caller's cancellation signal; defaults to the current activity's, if any. It must be
 * the signal `client` aborts its requests on.
 */
export async function fetchCachedProject(
    client: VertesiaClient,
    projectId: string,
    signal: AbortSignal | undefined = currentActivitySignal(),
): Promise<Project> {
    while (true) {
        const entry = cache.get(projectId);
        if (entry && Date.now() < entry.expiresAtMs) {
            return structuredClone(entry.project);
        }

        let pending = inFlight.get(projectId);
        const shared = pending !== undefined;
        if (!pending) {
            const promise: Promise<Project> = fetchAndStore(client, projectId).finally(() => {
                if (inFlight.get(projectId)?.promise === promise) {
                    inFlight.delete(projectId);
                }
            });
            pending = { promise, signal };
            inFlight.set(projectId, pending);
        }
        try {
            const project = shared ? await waitUnlessAborted(pending.promise, signal) : await pending.promise;
            return structuredClone(project);
        } catch (err) {
            // The shared fetch failed because the caller that started it was cancelled, not this one.
            if (shared && pending.signal?.aborted && !signal?.aborted) {
                continue;
            }
            throw err;
        }
    }
}

async function fetchAndStore(client: VertesiaClient, projectId: string): Promise<Project> {
    const project = await client.projects.retrieve(projectId);
    const now = Date.now();
    if (cache.size >= SWEEP_THRESHOLD) {
        for (const [id, { expiresAtMs }] of cache) {
            if (expiresAtMs <= now) {
                cache.delete(id);
            }
        }
    }
    cache.set(projectId, { project, expiresAtMs: now + PROJECT_CACHE_TTL_MS });
    return project;
}

/** Wait for `promise`, but reject with the abort reason as soon as `signal` aborts. */
function waitUnlessAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
    if (!signal) {
        return promise;
    }
    if (signal.aborted) {
        return Promise.reject(signal.reason);
    }
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
}

function currentActivitySignal(): AbortSignal | undefined {
    try {
        return Context.current().cancellationSignal;
    } catch {
        // Called outside an activity, e.g. by tests or utility code.
        return undefined;
    }
}

/** Drop every cached project. Meant for tests. */
export function clearProjectCache(): void {
    cache.clear();
    inFlight.clear();
}
