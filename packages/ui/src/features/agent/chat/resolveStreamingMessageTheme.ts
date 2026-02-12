import {
    type ResolvedStreamingMessageSlots,
    type StreamingMessageSlots,
    type StreamingMessageTheme,
    type ViewMode,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, mergeResolvedLayer, resolveSlots } from "./themeUtils";

// ---------------------------------------------------------------------------
// Cascade tree — StreamingMessage DOM hierarchy
// ---------------------------------------------------------------------------

type SlotKey = keyof StreamingMessageSlots;

const STREAMING_MESSAGE_TREE: SlotTree = {
    root: {
        card: {
            header: {
                headerLeft: { icon: {}, sender: {}, badge: {} },
                headerRight: { timestamp: {}, copyButton: {} },
            },
            content: { prose: {} },
        },
    },
};

/** Derived once at module load. */
const SLOT_CHAINS = buildSlotChains<SlotKey>(STREAMING_MESSAGE_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedStreamingMessageSlots = {};

/**
 * Resolve a StreamingMessageTheme into a flat set of class strings.
 */
export function resolveStreamingMessageTheme(
    theme: StreamingMessageTheme | undefined,
    viewMode?: ViewMode,
): ResolvedStreamingMessageSlots {
    if (!theme) return EMPTY;

    let resolved = resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);

    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveSlots<SlotKey>(theme.byViewMode[viewMode], SLOT_CHAINS, SLOT_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
