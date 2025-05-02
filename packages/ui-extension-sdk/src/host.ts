export * from "./PluginHost.js";
export * from "./PluginManager.js";
export type { HostContext as SharedExports } from "./HostContext.js";

import { HOST_CONTEXT_VAR, HostContext } from "./HostContext.js";

export function createSharedContext(context: HostContext): HostContext {
    (globalThis as any)[HOST_CONTEXT_VAR] = context;
    return context;
}
