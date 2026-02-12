import {
    type ResolvedToolCallGroupSlots,
    type ToolCallGroupSlots,
    type ToolCallGroupTheme,
    type ViewMode,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, mergeResolvedLayer, resolveSlots } from "./themeUtils";

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
    viewMode?: ViewMode,
): ResolvedToolCallGroupSlots {
    if (!theme) return EMPTY;

    let resolved = resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);

    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveSlots<SlotKey>(theme.byViewMode[viewMode], SLOT_CHAINS, SLOT_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
