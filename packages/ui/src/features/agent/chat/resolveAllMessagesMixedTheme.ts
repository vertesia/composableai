import {
    type AllMessagesMixedSlots,
    type AllMessagesMixedTheme,
    type ResolvedAllMessagesMixedSlots,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, resolveSlots } from "./themeUtils";

// ---------------------------------------------------------------------------
// Cascade tree — AllMessagesMixed DOM hierarchy
// ---------------------------------------------------------------------------

type SlotKey = keyof AllMessagesMixedSlots;

const ALL_MESSAGES_MIXED_TREE: SlotTree = {
    root: {
        tabsWrapper: {},
        emptyState: {},
        messageList: {},
        workingIndicator: {},
    },
};

/** Derived once at module load. */
const SLOT_CHAINS = buildSlotChains<SlotKey>(ALL_MESSAGES_MIXED_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedAllMessagesMixedSlots = {};

/**
 * Resolve an AllMessagesMixedTheme into a flat set of class strings.
 */
export function resolveAllMessagesMixedTheme(
    theme: AllMessagesMixedTheme | undefined,
): ResolvedAllMessagesMixedSlots {
    if (!theme) return EMPTY;
    return resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);
}
