/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import type {
    AgentMessage,
    ExperimentalAgentConversationTranscriptPage,
    ExperimentalAgentDocumentEditingAction,
} from '@vertesia/common';
import { AgentMessageType } from '@vertesia/common';
import { parseExperimentalAgentConversationTranscriptPage } from '@vertesia/common/canonical-stream-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { CanonicalAgentTranscript } from './CanonicalAgentTranscript.js';
import { initialCanonicalAgentContentState } from './canonicalAgentContent.js';
import { canonicalPendingUserInputs } from './canonicalPendingUserInput.js';
import type { CanonicalAgentTranscriptState } from './hooks/useCanonicalAgentTranscript.js';

const mediaClient = { objects: { getDownloadUrl: vi.fn() } };
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => ({ client: mediaClient }) }));

afterEach(cleanup);
const action = (identity: string): ExperimentalAgentDocumentEditingAction => ({
    operation_id: `edit:${identity}`,
    resource: { kind: 'store_document', document_id: 'document:one', name: 'Launch plan' },
    action: 'comment',
    anchor: { block_id: 'paragraph:one', block_type: 'paragraph', exact_text: 'Retained source text.' },
    comment: `Independent comment ${identity}`,
});
const draft = (id: string, workstreamId?: string): AgentMessage => ({
    type: AgentMessageType.QUESTION,
    timestamp: 100,
    workflow_run_id: 'workflow:one',
    message: `Local ${id}`,
    ...(workstreamId ? { workstream_id: workstreamId } : {}),
    details: { _optimistic: true, _messageId: `client:${id}`, _deliveryStatus: 'consumed', editing_action: action(id) },
});
function page(ids: string[]): ExperimentalAgentConversationTranscriptPage {
    const source = { conversation_id: 'conversation:one', revision: 4 };
    return {
        api_version: '=20260930',
        agent_run_id: 'agent:one',
        scope: 'root',
        snapshot: source,
        fragment: {
            format: 'llumiverse.conversation-transcript',
            schema_version: 0,
            experimental_revision: '2026-09-30.adoption.1',
            source,
            turns: ids.map((id) => ({
                id: `turn:${id}`,
                kind: 'user',
                status: 'completed',
                timestamps: { recorded_at: '2026-10-05T00:00:00.000Z' },
                blocks: [{ id: `block:${id}`, type: 'text', format: 'plain', text: `Actual model prompt ${id}` }],
                metadata: {
                    client_message_id: `client:${id}`,
                    display_message: `Accepted ${id}`,
                    editing_action: action(id),
                },
            })),
            assets: {},
            generations: {},
            completeness: {
                gap_before: false,
                gap_after: false,
                semantic_content: 'complete',
                metadata: ids.length ? 'partial' : 'omitted',
                native_replay: 'omitted',
                provenance: 'omitted',
                omitted_turns: [],
                omitted_blocks: [],
                omitted_generations: [],
                omitted_assets: [],
            },
        },
    };
}
const state = (ids: string[]): CanonicalAgentTranscriptState => ({
    pages: [],
    tail: page(ids),
    loading: false,
    tail_loading: false,
    discarded: false,
});
const live = initialCanonicalAgentContentState().live;
describe('canonical editing cards and unaccepted local authoring', () => {
    it('keeps two independent optimistic edit cards after ACK, then converges by actual accepted turn identity on persisted reload', () => {
        const pending = canonicalPendingUserInputs([draft('first'), draft('second'), draft('foreign', 'child')]);
        expect(pending.map((entry) => entry.client_message_id)).toEqual(['client:first', 'client:second']);
        const view = render(
            <I18nProvider lng="en">
                <CanonicalAgentTranscript
                    transcript={state([])}
                    live={live}
                    loadNext={async () => {}}
                    pendingInputs={pending}
                />
            </I18nProvider>,
        );
        expect(screen.getByText('Independent comment first')).not.toBeNull();
        expect(screen.getByText('Independent comment second')).not.toBeNull();
        expect(view.container.querySelectorAll('[data-canonical-pending-input]')).toHaveLength(2);
        // ACK changes delivery state; it does not fabricate an accepted contribution.
        expect(view.container.querySelectorAll('[data-canonical-turn-id]')).toHaveLength(0);
        view.rerender(
            <I18nProvider lng="en">
                <CanonicalAgentTranscript
                    transcript={state(['first'])}
                    live={live}
                    loadNext={async () => {}}
                    pendingInputs={pending}
                />
            </I18nProvider>,
        );
        expect(view.container.querySelectorAll('[data-canonical-pending-input]')).toHaveLength(1);
        expect(view.container.querySelector('[data-canonical-turn-id="turn:first"]')).not.toBeNull();
        expect(screen.getAllByText('Independent comment first')).toHaveLength(1);
        view.unmount();
        const reloadedPage = parseExperimentalAgentConversationTranscriptPage(
            JSON.parse(JSON.stringify(page(['first', 'second']))),
        );
        const loadedState = { ...state([]), tail: reloadedPage };
        const loaded = render(
            <I18nProvider lng="en">
                <CanonicalAgentTranscript transcript={loadedState} live={live} loadNext={async () => {}} />
            </I18nProvider>,
        );
        expect(loaded.container.querySelectorAll('[data-canonical-turn-id]')).toHaveLength(2);
        expect(loaded.container.querySelectorAll('[data-canonical-pending-input]')).toHaveLength(0);
        expect(screen.getAllByText('Independent comment first')).toHaveLength(1);
        expect(screen.getAllByText('Independent comment second')).toHaveLength(1);
        expect(screen.queryByText('Actual model prompt first')).toBeNull();
    });
    it('retains an accepted image and attachment text beside its edit card after persisted reload', () => {
        const accepted = page(['with-media']);
        const turn = accepted.fragment.turns[0];
        if (turn.kind !== 'user') throw new Error('Expected actual accepted user contribution');
        turn.blocks.push(
            { id: 'block:image', type: 'image', asset_id: 'asset:image', caption: 'Accepted edit attachment' },
            { id: 'block:attachment-text', type: 'text', format: 'plain', text: 'Original attached source text.' },
        );
        accepted.fragment.assets['asset:image'] = {
            id: 'asset:image',
            kind: 'image',
            mime_type: 'image/png',
            storage: { type: 'inline_base64', data: 'AAEC' },
            created_at: '2026-10-05T00:00:00.000Z',
        };
        const loaded = parseExperimentalAgentConversationTranscriptPage(JSON.parse(JSON.stringify(accepted)));
        render(
            <I18nProvider lng="en">
                <CanonicalAgentTranscript
                    transcript={{ ...state([]), tail: loaded }}
                    live={live}
                    loadNext={async () => {}}
                    hideToolCalls
                />
            </I18nProvider>,
        );
        expect(screen.getByText('Independent comment with-media')).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Accepted edit attachment' }).getAttribute('src')).toBe(
            'data:image/png;base64,AAEC',
        );
        expect(screen.getByText('Original attached source text.')).not.toBeNull();
        expect(screen.queryByText('Actual model prompt with-media')).toBeNull();
        expect(mediaClient.objects.getDownloadUrl).not.toHaveBeenCalled();
    });
    it('separates an absent root scope from a literal main child for local canonical input drafts', () => {
        const messages = [draft('root'), draft('main-child', 'main'), draft('root-child', 'root')];
        expect(canonicalPendingUserInputs(messages).map((entry) => entry.client_message_id)).toEqual(['client:root']);
        expect(canonicalPendingUserInputs(messages, 'main').map((entry) => entry.client_message_id)).toEqual([
            'client:main-child',
        ]);
        expect(canonicalPendingUserInputs(messages, 'root').map((entry) => entry.client_message_id)).toEqual([
            'client:root-child',
        ]);
    });
    it('never renders a persisted legacy QUESTION as an optimistic canonical contribution', () => {
        const old = draft('old');
        delete old.details?._optimistic;
        expect(canonicalPendingUserInputs([old])).toEqual([]);
        expect(canonicalPendingUserInputs([draft('child', 'child')])).toEqual([]);
        expect(canonicalPendingUserInputs([draft('child', 'child')], 'child')).toHaveLength(1);
    });
});

it.each(['leading-guidance', 'leading-media'] as const)(
    'renders the human non-edit message on persisted reload while preserving independent blocks (%s)',
    (order) => {
        const accepted = page(['display']);
        const turn = accepted.fragment.turns[0];
        if (turn.kind !== 'user') throw new Error('Expected actual accepted user contribution');
        turn.metadata = { client_message_id: 'client:display', display_message: 'Please inspect this diagram.' };
        turn.blocks = [
            {
                id: 'block:guidance',
                type: 'text',
                format: 'plain',
                text: 'HOST GUIDANCE: use the selected scene and preserve all shapes.',
            },
            { id: 'block:image', type: 'image', asset_id: 'asset:image', caption: 'User selected diagram' },
            { id: 'block:source', type: 'text', format: 'plain', text: 'Original independent attachment notes.' },
        ];
        if (order === 'leading-media') [turn.blocks[0], turn.blocks[1]] = [turn.blocks[1], turn.blocks[0]];
        accepted.fragment.assets['asset:image'] = {
            id: 'asset:image',
            kind: 'image',
            mime_type: 'image/png',
            storage: { type: 'inline_base64', data: 'AAEC' },
            created_at: '2026-10-05T00:00:00.000Z',
        };
        const loaded = parseExperimentalAgentConversationTranscriptPage(JSON.parse(JSON.stringify(accepted)));
        render(
            <I18nProvider lng="en">
                <CanonicalAgentTranscript
                    transcript={{ ...state([]), tail: loaded }}
                    live={live}
                    loadNext={async () => {}}
                    hideToolCalls
                />
            </I18nProvider>,
        );
        expect(screen.getByText('Please inspect this diagram.')).not.toBeNull();
        expect(screen.getByText('Original independent attachment notes.')).not.toBeNull();
        expect(screen.getByRole('img', { name: 'User selected diagram' }).getAttribute('src')).toBe(
            'data:image/png;base64,AAEC',
        );
        const guidance = screen.queryByText('HOST GUIDANCE: use the selected scene and preserve all shapes.');
        if (order === 'leading-guidance') expect(guidance).toBeNull();
        else expect(guidance).not.toBeNull(); // A non-leading accepted text block is never discarded.
    },
);

it('renders archived JSON/text tool cues from a validated persisted transcript reload without byte hydration', () => {
    mediaClient.objects.getDownloadUrl.mockClear();
    const retained = page([]);
    retained.fragment.turns = [
        {
            id: 'turn:archived-tool',
            kind: 'tool',
            status: 'completed',
            timestamps: { recorded_at: '2026-10-06T00:00:00.000Z' },
            blocks: [
                {
                    id: 'result:archived',
                    type: 'tool_result',
                    call_id: 'call:archived',
                    status: 'success',
                    content: [
                        {
                            id: 'original:json',
                            type: 'external_reference',
                            asset_id: 'asset:json',
                            original_type: 'json',
                            content_hash: 'sha256:json',
                            description: 'Archived JSON',
                            preview: '{"nested":[null,true,"ü 😀"]}',
                        },
                        {
                            id: 'original:text',
                            type: 'external_reference',
                            asset_id: 'asset:text',
                            original_type: 'text',
                            content_hash: 'sha256:text',
                            description: 'Archived original without preview',
                        },
                    ],
                },
            ],
        },
    ];
    const parsed = parseExperimentalAgentConversationTranscriptPage(JSON.parse(JSON.stringify(retained)));
    const view = render(
        <I18nProvider lng="en">
            <CanonicalAgentTranscript
                transcript={{ ...state([]), tail: parsed }}
                live={live}
                loadNext={async () => {}}
            />
        </I18nProvider>,
    );
    expect(screen.getByText('{"nested":[null,true,"ü 😀"]}')).not.toBeNull();
    expect(screen.getByText('Archived original without preview')).not.toBeNull();
    expect(view.container.querySelector('[data-canonical-turn-id="turn:archived-tool"]')).not.toBeNull();
    expect(view.container.querySelector('img,audio,video')).toBeNull();
    expect(mediaClient.objects.getDownloadUrl).not.toHaveBeenCalled();
    expect(JSON.stringify(parsed)).not.toContain('retrieval');
});
