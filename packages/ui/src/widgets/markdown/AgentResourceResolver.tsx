import type { AgentResourceAction, AgentResourceType } from '@vertesia/common';
import { createContext, useContext } from 'react';

/** Resource identity accepted by link resolvers from either structured tool metadata or Markdown. */
export interface AgentResourceLinkReference {
    type: AgentResourceType;
    id: string;
    label?: string;
    action?: AgentResourceAction;
    revision_id?: string;
}

export type AgentResourceTarget =
    | { kind: 'navigate'; href: string }
    | { kind: 'activate'; onActivate: () => void }
    | { kind: 'none' };

export interface ResourceResolveContext {
    workflowRunId?: string;
    source: 'structured' | 'markdown';
    /** Original custom-scheme URL when the reference came from Markdown. */
    rawHref?: string;
}

export type AgentResourceResolver = (
    ref: AgentResourceLinkReference,
    context: ResourceResolveContext,
) => AgentResourceTarget;

const unresolvedAgentResourceResolver: AgentResourceResolver = () => ({ kind: 'none' });
const AgentResourceResolverContext = createContext<AgentResourceResolver>(unresolvedAgentResourceResolver);

/** Supplies host-specific navigation for reusable chat and Markdown components. */
export const AgentResourceResolverProvider = AgentResourceResolverContext.Provider;

export function useAgentResourceResolver(): AgentResourceResolver {
    return useContext(AgentResourceResolverContext);
}

const RESOURCE_SCHEME_TYPES = {
    store: 'document',
    document: 'document',
    collection: 'collection',
    interaction: 'interaction',
    prompt: 'prompt',
    agent: 'agent',
    workflow: 'workflow',
    process: 'process',
    run: 'interaction_run',
} as const satisfies Record<string, AgentResourceType>;

/** Converts a supported agent Markdown scheme into the same resource identity used by tool metadata. */
export function parseAgentResourceHref(rawHref: string): AgentResourceLinkReference | undefined {
    const colonIndex = rawHref.indexOf(':');
    if (colonIndex <= 0) return undefined;

    const scheme = rawHref.slice(0, colonIndex);
    if (!Object.hasOwn(RESOURCE_SCHEME_TYPES, scheme)) return undefined;

    const id = rawHref
        .slice(colonIndex + 1)
        .trim()
        .replace(/^\/+/, '');
    if (!id) return undefined;

    return {
        type: RESOURCE_SCHEME_TYPES[scheme as keyof typeof RESOURCE_SCHEME_TYPES],
        id,
    };
}
