import {
    type ResolvedToolCallGroupSlots,
    type ToolCallGroupSlots,
    type ToolCallGroupTheme,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, resolveSlots } from "./themeUtils";

// ---------------------------------------------------------------------------
// Cascade tree — ToolCallGroup DOM hierarchy
// ---------------------------------------------------------------------------

type SlotKey = keyof ToolCallGroupSlots;

const TOOL_CALL_GROUP_TREE: SlotTree = {
    root: {
        header: {
            headerLeft: { statusIcon: {}, sender: {}, toolSummary: {} },
            headerRight: { timestamp: {}, copyButton: {} },
        },
        itemList: {},
        item: {
            itemHeader: { toolBadge: {} },
            itemContent: { prose: {}, itemDetails: {} },
        },
        fileDisplay: {},
    },
};

/** Derived once at module load. */
const SLOT_CHAINS = buildSlotChains<SlotKey>(TOOL_CALL_GROUP_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedToolCallGroupSlots = {};

/**
 * Resolve a ToolCallGroupTheme into a flat set of class strings.
 * No byType — status-based styling stays in the component.
 */
export function resolveToolCallGroupTheme(
    theme: ToolCallGroupTheme | undefined,
): ResolvedToolCallGroupSlots {
    if (!theme) return EMPTY;
    return resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);
}
