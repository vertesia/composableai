import {
    type ResolvedStreamingMessageSlots,
    type StreamingMessageSlots,
    type StreamingMessageTheme,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, resolveSlots } from "./themeUtils";

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
 * No byType — StreamingMessage has no message type variants.
 */
export function resolveStreamingMessageTheme(
    theme: StreamingMessageTheme | undefined,
): ResolvedStreamingMessageSlots {
    if (!theme) return EMPTY;
    return resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);
}
