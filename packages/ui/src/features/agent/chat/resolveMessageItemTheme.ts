import { type AgentMessageType } from "@vertesia/common";
import { cn } from "@vertesia/ui/core";
import {
    type MessageItemSlots,
    type MessageItemTheme,
    type ResolvedMessageItemSlots,
    type SlotValue,
} from "./ConversationThemeContext";

// ---------------------------------------------------------------------------
// Cascade tree — defines the DOM hierarchy. Chains are derived automatically.
// Parent classes cascade into children, mimicking CSS inheritance.
// ---------------------------------------------------------------------------

type SlotKey = keyof MessageItemSlots;
type SlotTree = { [key: string]: SlotTree };

/** MessageItem DOM hierarchy — single source of truth for cascade relationships. */
const MESSAGE_ITEM_TREE: SlotTree = {
    root: {
        card: {
            header: {
                headerLeft: { icon: {}, sender: {}, badge: {} },
                headerRight: { timestamp: {}, copyButton: {}, exportButton: {} },
            },
            content: { body: { prose: {} }, jsonPre: {} },
            artifacts: { artifactsLabel: {}, artifactImages: {}, artifactButtons: {} },
            details: { detailsToggle: {}, detailsContent: {} },
        },
    },
};

/** Recursively walk a SlotTree and build ancestor chains for each slot. */
function buildSlotChains<K extends string>(tree: SlotTree, path: K[] = []): Record<K, readonly K[]> {
    const chains = {} as Record<K, readonly K[]>;
    for (const [key, children] of Object.entries(tree)) {
        const chain = [...path, key as K];
        chains[key as K] = chain;
        Object.assign(chains, buildSlotChains<K>(children, chain));
    }
    return chains;
}

/** For each slot, the ordered list of ancestors (root-first) INCLUDING self. Derived once at module load. */
const SLOT_CHAINS = buildSlotChains<SlotKey>(MESSAGE_ITEM_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedMessageItemSlots = {};

// ---------------------------------------------------------------------------
// SlotValue helpers — extract cascade vs self-only parts
// ---------------------------------------------------------------------------

/** Extract the cascade part (propagates to descendants). Strings = cascade. */
function getCascade(value: SlotValue | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value.cascade;
}

/** Extract the self-only part (does NOT propagate). Strings have no self. */
function getSelf(value: SlotValue | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return undefined;
    return value.self;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a MessageItemTheme into a flat set of class strings.
 *
 * For each slot, the resolved value is built by walking the ancestor chain:
 *   - Ancestors contribute only their `cascade` part
 *   - Self contributes both `cascade` and `self`
 *   - Base cascade runs first (lower priority), then type cascade (higher)
 *
 * Returns undefined per slot when nothing is set — cn() will ignore it.
 */
export function resolveMessageItemTheme(
    theme: MessageItemTheme | undefined,
    messageType: AgentMessageType,
): ResolvedMessageItemSlots {
    if (!theme) return EMPTY;

    const typeOverrides = theme.byType?.[messageType];
    const resolved: ResolvedMessageItemSlots = {};

    for (const slot of SLOT_KEYS) {
        const chain = SLOT_CHAINS[slot];
        const values: (string | undefined)[] = [];

        // Base cascade (lower priority)
        for (const ancestor of chain) {
            values.push(getCascade(theme[ancestor]));
            if (ancestor === slot) {
                values.push(getSelf(theme[ancestor]));
            }
        }

        // Type-specific cascade (higher priority)
        if (typeOverrides) {
            for (const ancestor of chain) {
                values.push(getCascade(typeOverrides[ancestor]));
                if (ancestor === slot) {
                    values.push(getSelf(typeOverrides[ancestor]));
                }
            }
        }

        const merged = cn(...values);
        if (merged) {
            resolved[slot] = merged;
        }
    }

    return resolved;
}
