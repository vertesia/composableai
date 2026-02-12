import {
    type ModernAgentConversationSlots,
    type ModernAgentConversationTheme,
    type ResolvedModernAgentConversationSlots,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, resolveSlots } from "./themeUtils";

type SlotKey = keyof ModernAgentConversationSlots;

const MODERN_AGENT_CONVERSATION_TREE: SlotTree = {
    root: {
        conversationArea: {
            headerWrapper: {},
            emptyState: {},
            inputWrapper: {},
        },
        planPanel: {},
        dragOverlay: {},
    },
};

const SLOT_CHAINS = buildSlotChains<SlotKey>(MODERN_AGENT_CONVERSATION_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedModernAgentConversationSlots = {};

export function resolveModernAgentConversationTheme(
    theme: ModernAgentConversationTheme | undefined,
): ResolvedModernAgentConversationSlots {
    if (!theme) return EMPTY;
    return resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);
}
