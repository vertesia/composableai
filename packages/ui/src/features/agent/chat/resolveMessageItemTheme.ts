import { type AgentMessageType } from "@vertesia/common";
import { cn } from "@vertesia/ui/core";
import {
    type MessageItemSlots,
    type MessageItemTheme,
    type ResolvedMessageItemSlots,
    type ViewMode,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, getCascade, getSelf, mergeResolvedLayer, resolveSlots } from "./themeUtils";

// ---------------------------------------------------------------------------
// Cascade tree — defines the DOM hierarchy. Chains are derived automatically.
// ---------------------------------------------------------------------------

type SlotKey = keyof MessageItemSlots;

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

/** Derived once at module load. */
const SLOT_CHAINS = buildSlotChains<SlotKey>(MESSAGE_ITEM_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedMessageItemSlots = {};

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
    viewMode?: ViewMode,
): ResolvedMessageItemSlots {
    if (!theme) return EMPTY;

    const typeOverrides = theme.byType?.[messageType];
    let resolved: ResolvedMessageItemSlots = {};

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

    // ViewMode-specific cascade (highest priority)
    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveSlots<SlotKey>(theme.byViewMode[viewMode], SLOT_CHAINS, SLOT_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
