import { cn } from "@vertesia/ui/core";

// ---------------------------------------------------------------------------
// Shared primitive types
// ---------------------------------------------------------------------------

export type ViewMode = "stacked" | "sliding";

/**
 * A theme class value. Strings cascade to all descendants (backward compatible).
 * Use an object to control cascade vs self-only:
 *
 * ```ts
 * root: "font-mono"                                    // cascades to all
 * root: { self: "border rounded-lg" }                  // root only, no cascade
 * root: { cascade: "font-mono", self: "border" }       // root gets both, children get font-mono
 * ```
 */
export type ThemeClassValue = string | {
    /** Classes that cascade to this element AND all descendants */
    cascade?: string;
    /** Classes that apply ONLY to this element, do NOT cascade */
    self?: string;
};

// ---------------------------------------------------------------------------
// Shared utilities for theme cascade resolution
// ---------------------------------------------------------------------------

/** Tree structure defining parent-child relationships between theme classes. */
export type ClassTree = { [key: string]: ClassTree };

/** Recursively walk a ClassTree and build ancestor chains for each class key. */
export function buildClassChains<K extends string>(tree: ClassTree, path: K[] = []): Record<K, readonly K[]> {
    const chains = {} as Record<K, readonly K[]>;
    for (const [key, children] of Object.entries(tree)) {
        const chain = [...path, key as K];
        chains[key as K] = chain;
        Object.assign(chains, buildClassChains<K>(children, chain));
    }
    return chains;
}

/** Extract the cascade part (propagates to descendants). Strings = cascade. */
export function getCascade(value: ThemeClassValue | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value.cascade;
}

/** Extract the self-only part (does NOT propagate). Strings have no self. */
export function getSelf(value: ThemeClassValue | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return undefined;
    return value.self;
}

/**
 * Generic theme class resolver. Walks cascade chains and merges class values.
 *
 * For each class key:
 *   - Ancestors contribute only their `cascade` part
 *   - Self contributes both `cascade` and `self`
 *
 * Returns undefined per key when nothing is set — cn() will ignore it.
 */
export function resolveClasses<K extends string>(
    classes: Partial<Record<K, ThemeClassValue>> | undefined,
    chains: Record<K, readonly K[]>,
    keys: readonly K[],
): Partial<Record<K, string>> {
    if (!classes) return {};

    const resolved: Partial<Record<K, string>> = {};

    for (const key of keys) {
        const chain = chains[key];
        const values: (string | undefined)[] = [];

        for (const ancestor of chain) {
            values.push(getCascade(classes[ancestor]));
            if (ancestor === key) {
                values.push(getSelf(classes[ancestor]));
            }
        }

        const merged = cn(...values);
        if (merged) {
            resolved[key] = merged;
        }
    }

    return resolved;
}

/**
 * Merge an overlay layer on top of a base resolved theme classes object.
 * Overlay values are appended via cn() so they override conflicting base classes.
 */
export function mergeResolvedLayer<K extends string>(
    base: Partial<Record<K, string>>,
    overlay: Partial<Record<K, string>>,
): Partial<Record<K, string>> {
    const result = { ...base };
    for (const key in overlay) {
        if (overlay[key]) {
            result[key] = cn(result[key], overlay[key]);
        }
    }
    return result;
}
