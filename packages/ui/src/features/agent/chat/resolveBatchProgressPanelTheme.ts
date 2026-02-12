import {
    type BatchProgressPanelSlots,
    type BatchProgressPanelTheme,
    type ResolvedBatchProgressPanelSlots,
    type ViewMode,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, mergeResolvedLayer, resolveSlots } from "./themeUtils";

// ---------------------------------------------------------------------------
// Cascade tree — BatchProgressPanel DOM hierarchy
// ---------------------------------------------------------------------------

type SlotKey = keyof BatchProgressPanelSlots;

const BATCH_PROGRESS_PANEL_TREE: SlotTree = {
    root: {
        header: {
            headerLeft: { statusIcon: {}, sender: {}, toolName: {}, progressCount: {} },
            headerRight: { timestamp: {}, copyButton: {} },
        },
        progressBar: { track: {}, counters: {} },
        itemList: { item: {} },
        summary: {},
    },
};

/** Derived once at module load. */
const SLOT_CHAINS = buildSlotChains<SlotKey>(BATCH_PROGRESS_PANEL_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedBatchProgressPanelSlots = {};

/**
 * Resolve a BatchProgressPanelTheme into a flat set of class strings.
 */
export function resolveBatchProgressPanelTheme(
    theme: BatchProgressPanelTheme | undefined,
    viewMode?: ViewMode,
): ResolvedBatchProgressPanelSlots {
    if (!theme) return EMPTY;

    let resolved = resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);

    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveSlots<SlotKey>(theme.byViewMode[viewMode], SLOT_CHAINS, SLOT_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
