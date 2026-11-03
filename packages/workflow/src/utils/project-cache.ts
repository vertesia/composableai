import type { VertesiaClient } from '@vertesia/client';
import type { Project } from '@vertesia/common';

/**
 * Per-process cache of projects, keyed by project ID.
 *
 * Activities read slow-moving project settings (`project.configuration`) on almost every run. Without a
 * process-wide cache, each activity fetches the project from the API again. A cached project is served for
 * {@link PROJECT_CACHE_TTL_MS}, so a configuration change reaches the workers within that delay.
 *
 * Concurrent misses for the same project share one fetch. A failed fetch is never cached: the error
 * reaches every caller waiting on it, and the next call fetches again.
 */
export const PROJECT_CACHE_TTL_MS = 60_000;

/** Above this size, a new entry first evicts the expired ones, so projects no longer used do not pile up. */
const SWEEP_THRESHOLD = 500;

interface CacheEntry {
    project: Project;
    expiresAtMs: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Project>>();

/**
 * Get a project from the per-process cache, fetching it with `client` on a miss or after expiry.
 * Each caller gets its own copy, so a caller that mutates the result does not change what others read.
 */
export async function fetchCachedProject(client: VertesiaClient, projectId: string): Promise<Project> {
    const entry = cache.get(projectId);
    if (entry && Date.now() < entry.expiresAtMs) {
        return structuredClone(entry.project);
    }

    let pending = inFlight.get(projectId);
    if (!pending) {
        pending = fetchAndStore(client, projectId);
        inFlight.set(projectId, pending);
    }
    return structuredClone(await pending);
}

async function fetchAndStore(client: VertesiaClient, projectId: string): Promise<Project> {
    try {
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
    } finally {
        inFlight.delete(projectId);
    }
}

/** Drop every cached project. Meant for tests. */
export function clearProjectCache(): void {
    cache.clear();
    inFlight.clear();
}
