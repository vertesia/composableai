import { JSONObject, ToolDefinition, ToolUse } from "@llumiverse/common";
import { AsyncConversationExecutionPayload } from "./interaction.js";
import { WorkflowExecutionBaseParams } from "./store/index.js";

/**
 * A vertesia plugin manifest
 */
export interface PluginManifest<MetaT = any> {
    id: string;
    /**
     * The kind of the plugin.
     */
    kind: "ui" | "tool";
    /**
     * A metadata field which can be used for each kind of plugin to store additional data
     */
    metadata?: MetaT;
    src: string;
    name: string;
    version: string;
    publisher: string;
    title?: string;
    description?: string;
    icon?: string;
    /**
     * Whether the plugin should be loaded as part of the host layout
     * or in a new tab.
     * If external is true, the plugin must manage itself the global layout of the page.
     * It will be loaded in a new tab.
     * If external is false the plugin will be loaded as a page of the host application and it will share the same layout.
     * Default is false.
     * This is only usefull for UI plugins.
     */
    external?: boolean;
    /**
     * The default is "beta".
     */
    status?: "beta" | "stable" | "deprecated" | "hidden";
}

export interface UIPluginManifest extends PluginManifest {
    kind: "ui";
    metadata: never;
}

export interface ToolPluginManifest extends PluginManifest {
    kind: "tool";
    /**
     * The definitions of the exported tools
     */
    metadata: ToolDefinition[];
}

export interface PluginToolContext<ParamsT = JSONObject> {
    payload: WorkflowExecutionBaseParams<AsyncConversationExecutionPayload>;
    tool_use: ToolUse<ParamsT>; //params?
    plugin: string; // plugin id
}
