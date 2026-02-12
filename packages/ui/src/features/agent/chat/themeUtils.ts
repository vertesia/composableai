import { cn } from "@vertesia/ui/core";
import { type SlotValue } from "./ConversationThemeContext";

// ---------------------------------------------------------------------------
// Shared utilities for theme cascade resolution
// ---------------------------------------------------------------------------

/** Tree structure defining parent-child relationships between slots. */
export type SlotTree = { [key: string]: SlotTree };

/** Recursively walk a SlotTree and build ancestor chains for each slot. */
export function buildSlotChains<K extends string>(tree: SlotTree, path: K[] = []): Record<K, readonly K[]> {
    const chains = {} as Record<K, readonly K[]>;
    for (const [key, children] of Object.entries(tree)) {
        const chain = [...path, key as K];
        chains[key as K] = chain;
        Object.assign(chains, buildSlotChains<K>(children, chain));
    }
    return chains;
}

/** Extract the cascade part (propagates to descendants). Strings = cascade. */
export function getCascade(value: SlotValue | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value.cascade;
}

/** Extract the self-only part (does NOT propagate). Strings have no self. */
export function getSelf(value: SlotValue | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return undefined;
    return value.self;
}

/**
 * Generic slot resolver. Walks cascade chains and merges slot values.
 *
 * For each slot:
 *   - Ancestors contribute only their `cascade` part
 *   - Self contributes both `cascade` and `self`
 *
 * Returns undefined per slot when nothing is set — cn() will ignore it.
 */
export function resolveSlots<K extends string>(
    slots: Partial<Record<K, SlotValue>> | undefined,
    chains: Record<K, readonly K[]>,
    keys: readonly K[],
): Partial<Record<K, string>> {
    if (!slots) return {};

    const resolved: Partial<Record<K, string>> = {};

    for (const slot of keys) {
        const chain = chains[slot];
        const values: (string | undefined)[] = [];

        for (const ancestor of chain) {
            values.push(getCascade(slots[ancestor]));
            if (ancestor === slot) {
                values.push(getSelf(slots[ancestor]));
            }
        }

        const merged = cn(...values);
        if (merged) {
            resolved[slot] = merged;
        }
    }

    return resolved;
}

/**
 * Merge an overlay layer on top of a base resolved slots object.
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
