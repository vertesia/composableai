/**
 * Defensive readers for content-store `properties` blobs.
 *
 * The Memory corpus is authored by an agent, so every field has to be treated as optional and
 * possibly of the wrong type: a record that cannot be understood is skipped rather than rendered
 * half-parsed.
 */

export function asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => (typeof item === 'string' && item.trim().length > 0 ? [item.trim()] : []));
}

/**
 * Statement context (`{ commodity: 'GPUs', size: '~250MW' }`). Only scalar entries survive: a
 * nested object has no compact rendering on an edge label.
 */
export function readQualifiers(value: unknown): Record<string, string | number> | undefined {
    const record = asRecord(value);
    const entries: [string, string | number][] = [];
    for (const [key, item] of Object.entries(record)) {
        if (typeof item === 'string' && item.trim().length > 0) entries.push([key, item.trim()]);
        else if (typeof item === 'number' && Number.isFinite(item)) entries.push([key, item]);
    }
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
