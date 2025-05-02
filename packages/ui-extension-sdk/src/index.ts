/**
 * This file contains the host context which is a set of live components and hooks shared
 * with the plugins.
 * The plugin must import a component or hook from the host context by using:
 * import {SomeComponnet, useSomeHook } from '@vetesia/ui-extension-sdk/context';
 */

import { HOST_CONTEXT_VAR, HostContext } from "./HostContext.js";

const context = (globalThis as any)[HOST_CONTEXT_VAR] as HostContext;

export const {
    useUserSession,
    useRouterContext,
    useNavigate,
    useLocation,
    MultiPagePlugin,
} = context;
