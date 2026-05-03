import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { HomeIcon, MessageSquare } from "lucide-react";
import { ChatPage, HomePage } from "./pages";

/**
 * Plugin route entry with metadata.
 *
 * The metadata fields drive the sidebar (label/icon/sidebarGroup) and the
 * command palette (label + path). Routes used as deep links (with :params or
 * fallbacks like `*`) should set hideFromNav.
 */
export interface PluginRoute {
    path: string;
    Component: ComponentType;
    /** Display label for sidebar and command palette. Translation key or literal. */
    label?: string;
    /** Lucide icon for sidebar item. */
    icon?: LucideIcon;
    /** Sidebar group title. Routes with the same group render together. */
    sidebarGroup?: string;
    /** Hide from sidebar and command palette (deep links, fallback routes). */
    hideFromNav?: boolean;
}

export const routes: PluginRoute[] = [
    {
        path: "/",
        Component: HomePage,
        label: "nav.home",
        icon: HomeIcon,
    },
    {
        path: "/chat",
        Component: ChatPage,
        label: "nav.newChat",
        icon: MessageSquare,
    },
    {
        path: "/chat/:agentRunId",
        Component: ChatPage,
        hideFromNav: true,
    },
    {
        path: "*",
        Component: () => <div className="p-6 text-destructive">Not found</div>,
        hideFromNav: true,
    },
];
