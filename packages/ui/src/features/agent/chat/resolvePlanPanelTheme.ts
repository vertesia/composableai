import {
    type PlanPanelSlots,
    type PlanPanelTheme,
    type ResolvedPlanPanelSlots,
} from "./ConversationThemeContext";
import { type SlotTree, buildSlotChains, resolveSlots } from "./themeUtils";

type SlotKey = keyof PlanPanelSlots;

const PLAN_PANEL_TREE: SlotTree = {
    root: {
        header: { title: {} },
        scrollContent: {
            taskProgress: { progressTitle: {}, progressTrack: {}, progressCount: {} },
            planSelector: {},
            stepsContainer: {
                stepsHeader: {},
                stepsList: { stepItem: {} },
                stepsEmpty: {},
            },
            workstreams: {
                workstreamsHeader: {},
                workstreamItem: {},
            },
        },
    },
};

const SLOT_CHAINS = buildSlotChains<SlotKey>(PLAN_PANEL_TREE);
const SLOT_KEYS = Object.keys(SLOT_CHAINS) as SlotKey[];

const EMPTY: ResolvedPlanPanelSlots = {};

export function resolvePlanPanelTheme(
    theme: PlanPanelTheme | undefined,
): ResolvedPlanPanelSlots {
    if (!theme) return EMPTY;
    return resolveSlots<SlotKey>(theme, SLOT_CHAINS, SLOT_KEYS);
}
