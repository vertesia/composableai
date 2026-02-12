import {
    type ResolvedWorkstreamTabsSlots,
    type WorkstreamTabsSlots,
    type WorkstreamTabsTheme,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, resolveSlots } from "./themeUtils";

type SlotKey = keyof WorkstreamTabsSlots;

const WORKSTREAM_TABS_TREE: SlotTree = {
    root: {
        tab: {
            tabActive: {},
            tabInactive: {},
            badgeGroup: {
                badge: {
                    badgeActive: {},
                    badgeInactive: {},
                },
            },
        },
        empty: {},
    },
};

const SLOT_CHAINS = buildSlotChains<SlotKey>(WORKSTREAM_TABS_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedWorkstreamTabsSlots = {};

export function resolveWorkstreamTabsTheme(
    theme: WorkstreamTabsTheme | undefined,
): ResolvedWorkstreamTabsSlots {
    if (!theme) return EMPTY;
    return resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);
}
