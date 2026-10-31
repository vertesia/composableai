import { render } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { ReactRouterContext, type RouterContext } from '../../../../router/index.js';
import { UserSession, UserSessionContext } from '../../../../session/index.js';
import { AgentResourceResolverProvider } from '../../../../widgets/markdown/AgentResourceResolver';
import {
    NotificationAcknowledgementContext,
    type NotificationAcknowledgementRegistry,
} from '../../../notifications/NotificationAcknowledgement.js';
import AllMessagesMixed from './AllMessagesMixed';

/** Reports every observed element as intersecting, as soon as it is observed. */
class VisibleIntersectionObserver {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
        this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
        );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

function makeMessage(overrides: Partial<AgentMessage>): AgentMessage {
    return {
        timestamp: 0,
        workflow_run_id: 'wf-run-1',
        type: AgentMessageType.THOUGHT,
        message: '',
        workstream_id: 'main',
        ...overrides,
    };
}

function makeRouterContext(): RouterContext {
    return {
        location: window.location,
        route: { path: '/', Component: () => null },
        params: {},
        state: null,
        matchedRoutePath: '/',
        navigate: vi.fn(),
        router: {
            navigate: vi.fn(),
            getTopRouter: () => ({ navigator: { addStickyParams: (href: string) => href } }),
        },
    } as unknown as RouterContext;
}

function renderConversation(
    messages: AgentMessage[],
    registry: NotificationAcknowledgementRegistry | null,
    viewMode: 'stacked' | 'sliding',
) {
    const bottomRef = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
    const session = new UserSession({
        files: { getArtifactDownloadUrl: vi.fn() },
    } as unknown as VertesiaClient);
    return render(
        <I18nProvider lng="en">
            <ReactRouterContext.Provider value={makeRouterContext()}>
                <UserSessionContext.Provider value={session}>
                    <AgentResourceResolverProvider
                        value={(resource) => ({ kind: 'navigate', href: `/resources/${resource.id}` })}
                    >
                        <NotificationAcknowledgementContext.Provider value={registry}>
                            <AllMessagesMixed
                                messages={messages}
                                bottomRef={bottomRef}
                                viewMode={viewMode}
                                isCompleted={true}
                                artifactRunId="agent-run-1"
                                agentRunId="agent-run-1"
                            />
                        </NotificationAcknowledgementContext.Provider>
                    </AgentResourceResolverProvider>
                </UserSessionContext.Provider>
            </ReactRouterContext.Provider>
        </I18nProvider>,
    );
}

function recordingRegistry() {
    const visible = new Set<string>();
    const registry: NotificationAcknowledgementRegistry = {
        register: (occurrence, isVisible) => {
            const key = `${occurrence.type}:${occurrence.id}`;
            if (isVisible) visible.add(key);
            else visible.delete(key);
        },
    };
    return { registry, visible };
}

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
    Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe.each(['stacked', 'sliding'] as const)('AllMessagesMixed acknowledgement (%s view)', (viewMode) => {
    it('acknowledges the turn when an interactive run waits for the user', () => {
        const { registry, visible } = recordingRegistry();
        renderConversation(
            [
                makeMessage({ type: AgentMessageType.QUESTION, message: 'Hello', timestamp: 1 }),
                makeMessage({ type: AgentMessageType.ANSWER, message: 'Hi there', timestamp: 2 }),
                makeMessage({ type: AgentMessageType.IDLE, timestamp: 3 }),
            ],
            registry,
            viewMode,
        );
        expect([...visible]).toEqual(['agent_turn:agent-run-1']);
    });

    it('acknowledges the run end when the run completed', () => {
        const { registry, visible } = recordingRegistry();
        renderConversation(
            [
                makeMessage({ type: AgentMessageType.QUESTION, message: 'Hello', timestamp: 1 }),
                makeMessage({ type: AgentMessageType.ANSWER, message: 'Done', timestamp: 2 }),
                makeMessage({ type: AgentMessageType.COMPLETE, timestamp: 3 }),
            ],
            registry,
            viewMode,
        );
        expect([...visible].sort()).toEqual(['agent_run_end:agent-run-1', 'agent_turn:agent-run-1']);
    });

    it('acknowledges a rendered question by its request id', () => {
        const { registry, visible } = recordingRegistry();
        renderConversation(
            [
                makeMessage({ type: AgentMessageType.QUESTION, message: 'Hello', timestamp: 1 }),
                makeMessage({
                    type: AgentMessageType.REQUEST_INPUT,
                    message: 'Which region?',
                    timestamp: 2,
                    details: { request_id: 'req-1' },
                }),
            ],
            registry,
            viewMode,
        );
        expect(visible.has('agent_request:agent-run-1:req-1')).toBe(true);
    });
});

describe('AllMessagesMixed without a notification store', () => {
    it('renders no acknowledgement wrappers', () => {
        const { container } = renderConversation(
            [
                makeMessage({ type: AgentMessageType.ANSWER, message: 'Hi there', timestamp: 2 }),
                makeMessage({ type: AgentMessageType.IDLE, timestamp: 3 }),
            ],
            null,
            'stacked',
        );
        expect(container.querySelector('[data-notification-ack]')).toBeNull();
    });
});
