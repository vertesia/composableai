import { render } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { ReactRouterContext, type RouterContext } from '../../../router/index.js';
import { UserSession, UserSessionContext } from '../../../session/index.js';
import { AgentResourceResolverProvider } from '../../../widgets/markdown/AgentResourceResolver';
import { AgentApprovalModeSelector } from './AgentApprovalModeSelector';
import AllMessagesMixed from './ModernAgentOutput/AllMessagesMixed';
import { AttachmentPreviewList } from './ModernAgentOutput/AttachmentPreview';
import MessageInput from './ModernAgentOutput/MessageInput';

/**
 * These `data-*` attributes are a styling contract for apps embedding the agent
 * conversation, which cannot reach these elements through `className`. Nothing in this
 * repository reads them, so without these assertions a cleanup could drop one and leave
 * CI green while silently breaking downstream styling.
 *
 * Each case also asserts the utility class the attribute replaces, so the attribute
 * cannot drift onto a different element. If an element genuinely moves, update the test
 * alongside it — don't delete the assertion.
 */

beforeAll(() => {
    // jsdom implements no layout, so the conversation's scroll-to-bottom effect throws.
    Element.prototype.scrollIntoView = vi.fn();
});

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

function renderInChat(ui: React.ReactElement) {
    const session = new UserSession({
        files: { getArtifactDownloadUrl: vi.fn() },
    } as unknown as VertesiaClient);

    return render(
        <I18nProvider lng="en">
            <ReactRouterContext.Provider value={makeRouterContext()}>
                <UserSessionContext.Provider value={session}>
                    <AgentResourceResolverProvider
                        value={(resource: { type: string; id: string }) => ({
                            kind: 'navigate' as const,
                            href: `/resources/${resource.type}/${resource.id}`,
                        })}
                    >
                        {ui}
                    </AgentResourceResolverProvider>
                </UserSessionContext.Provider>
            </ReactRouterContext.Provider>
        </I18nProvider>,
    );
}

describe('agent chat data attributes', () => {
    it('marks the user message bubble', () => {
        const userMessage: AgentMessage = {
            timestamp: 1_000,
            workflow_run_id: 'run-1',
            workstream_id: 'main',
            type: AgentMessageType.QUESTION,
            message: 'Summarise the quarterly report.',
        };

        renderInChat(
            <AllMessagesMixed
                messages={[userMessage]}
                bottomRef={React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>}
                viewMode="sliding"
                artifactRunId="run-1"
            />,
        );

        const bubble = document.querySelector('[data-agent-user-bubble]');
        expect(bubble).not.toBeNull();
        expect(bubble?.className).toContain('bg-mixer-muted/35');
        expect(bubble?.textContent).toContain('Summarise the quarterly report.');
    });

    it('marks the composer input row', () => {
        renderInChat(<MessageInput onSend={() => {}} />);

        const composer = document.querySelector('[data-agent-composer-input]');
        expect(composer).not.toBeNull();
        expect(composer?.className).toContain('max-w-3xl');
        expect(composer?.className).toContain('bg-mixer-muted/15');
    });

    it('marks the attachment chip row', () => {
        renderInChat(<AttachmentPreviewList items={[{ id: 'file-1', name: 'report.csv' }]} />);

        const list = document.querySelector('[data-agent-attachment-list]');
        expect(list).not.toBeNull();
        expect(list?.className).toContain('flex-wrap');
    });

    it('marks the approval mode pill', () => {
        renderInChat(<AgentApprovalModeSelector mode="ask" onChange={() => {}} />);

        const pill = document.querySelector('[data-agent-approval-pill]');
        expect(pill).not.toBeNull();
        // Must reach the rendered DOM element rather than being swallowed by the Button
        // wrapper or the Radix `asChild` trigger it sits inside.
        expect(pill?.tagName).toBe('BUTTON');
        expect(pill?.className).toContain('rounded-full');
    });
});
