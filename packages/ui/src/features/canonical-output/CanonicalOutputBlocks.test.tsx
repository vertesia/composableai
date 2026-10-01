// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CanonicalInteractionOutputFragment } from '@vertesia/client';
import type { ConversationOutputAsset, ConversationOutputBlock } from '@vertesia/common';
import { useLayoutEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/index.js';
import { CanonicalAcceptedOutput } from './CanonicalOutputBlocks.js';

const getDownloadUrl = vi.fn();
const defaultClient = { objects: { getDownloadUrl } };
let sessionClient = defaultClient;
vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ client: sessionClient }),
}));
const RECORDED_AT = '2026-10-01T00:00:00.000Z';

function renderAcceptedOutput(output: CanonicalInteractionOutputFragment) {
    return render(
        <I18nProvider lng="en">
            <CanonicalAcceptedOutput fragment={output} />
        </I18nProvider>,
    );
}

function ObserveCommittedMedia({
    fragment,
    onCommit,
}: {
    fragment: CanonicalInteractionOutputFragment;
    onCommit: (source: string | undefined) => void;
}) {
    const root = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const media = root.current?.querySelector('img, video, audio, a');
        onCommit(media?.getAttribute('src') ?? media?.getAttribute('href') ?? undefined);
    });
    return (
        <div ref={root}>
            <CanonicalAcceptedOutput fragment={fragment} />
        </div>
    );
}

function fragment(
    blocks: ConversationOutputBlock[],
    assets: Record<string, ConversationOutputAsset> = {},
): CanonicalInteractionOutputFragment {
    return {
        format: 'llumiverse.conversation-output',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        source: { conversation_id: 'conversation-1', revision: 1 },
        receipt: {
            id: 'response-1',
            conversation_id: 'conversation-1',
            base_revision: 0,
            result_revision: 1,
            recorded_at: RECORDED_AT,
            accepted_turn_ids: ['turn-1'],
            accepted_generation_ids: ['generation-1'],
            accepted_asset_ids: Object.keys(assets),
        },
        turn: {
            id: 'turn-1',
            kind: 'agent',
            authority: 'ordinary',
            blocks,
            status: 'completed',
            timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
            provenance: { type: 'generated' },
            model_visibility: 'include',
            generation_id: 'generation-1',
        },
        generation: {
            id: 'generation-1',
            record_source: 'executed',
            request_id: 'request-1',
            attempt_id: 'attempt-1',
            purpose: 'interaction',
            requested_model: 'model-1',
            provider: 'provider-1',
            protocol: 'provider.protocol',
            adapter_version: 'adapter-1',
            status: 'completed',
            timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
            source: { conversation_id: 'conversation-1', revision: 0 },
        },
        assets,
        completeness: {
            history: 'omitted',
            native_replay: 'omitted',
            metadata: 'omitted',
            semantic_content: 'complete',
            omitted_block_ids: [],
            omitted_asset_ids: [],
        },
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionClient = defaultClient;
});

describe('CanonicalAcceptedOutput', () => {
    it('renders canonical text, JSON, and media blocks directly', () => {
        const image: ConversationOutputAsset = {
            id: 'asset-1',
            kind: 'image',
            mime_type: 'image/png',
            storage: { type: 'inline_base64', data: 'AAEC' },
            provenance: { type: 'generated', generation_id: 'generation-1' },
            created_at: RECORDED_AT,
        };
        renderAcceptedOutput(
            fragment(
                [
                    { id: 'text-1', type: 'text', text: 'canonical text', format: 'plain' },
                    { id: 'json-1', type: 'json', value: { answer: 42 } },
                    { id: 'image-1', type: 'image', asset_id: image.id, caption: 'canonical chart' },
                ],
                { [image.id]: image },
            ),
        );

        expect(screen.getByText('canonical text')).not.toBeNull();
        expect(screen.getByText('Answer:')).not.toBeNull();
        expect(screen.getByRole('img', { name: 'canonical chart' }).getAttribute('src')).toBe(
            'data:image/png;base64,AAEC',
        );
    });

    it('switches canonical JSON from the structured preview to the real code renderer', () => {
        const { container } = renderAcceptedOutput(fragment([{ id: 'json-1', type: 'json', value: { answer: 42 } }]));

        expect(screen.getByText('Answer:')).not.toBeNull();
        expect(container.querySelector('pre code')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'JSON' }));

        expect(container.querySelector('pre code')?.textContent).toContain('"answer": 42');
    });

    it('labels canonical reasoning and tool calls', () => {
        renderAcceptedOutput(
            fragment([
                { id: 'reasoning-1', type: 'reasoning', text: 'Check the source.', representation: 'summary' },
                {
                    id: 'tool-1',
                    type: 'tool_call',
                    call_id: 'call-1',
                    tool_name: 'lookup_record',
                    executor: 'application',
                    arguments: { type: 'json', value: { id: 'record-1' } },
                },
            ]),
        );

        expect(screen.getByText('Reasoning')).not.toBeNull();
        expect(screen.getByText('Tool call: lookup_record')).not.toBeNull();
    });

    it('does not apply a stale signed asset URL after the fragment changes', async () => {
        let resolveDownload: (value: { url: string }) => void = () => undefined;
        getDownloadUrl.mockImplementation(
            () =>
                new Promise<{ url: string }>((resolve) => {
                    resolveDownload = resolve;
                }),
        );
        const stored: ConversationOutputAsset = {
            id: 'asset-1',
            kind: 'image',
            mime_type: 'image/png',
            storage: { type: 'external', resolver: 'google_uri', locator: { uri: 'gs://bucket/old.png' } },
            provenance: { type: 'generated', generation_id: 'generation-1' },
            created_at: RECORDED_AT,
        };
        const inline = { ...stored, storage: { type: 'inline_base64' as const, data: 'NEW' } };
        const block = { id: 'image-1', type: 'image' as const, asset_id: stored.id, caption: 'chart' };
        const view = render(<CanonicalAcceptedOutput fragment={fragment([block], { [stored.id]: stored })} />);
        await waitFor(() => expect(getDownloadUrl).toHaveBeenCalledWith('gs://bucket/old.png'));

        view.rerender(<CanonicalAcceptedOutput fragment={fragment([block], { [inline.id]: inline })} />);
        resolveDownload({ url: 'https://signed.example/old.png' });

        await waitFor(() =>
            expect(screen.getByRole('img', { name: 'chart' }).getAttribute('src')).toBe('data:image/png;base64,NEW'),
        );
    });
    it('never commits a previously resolved signed URL after switching stored assets', async () => {
        getDownloadUrl.mockResolvedValueOnce({ url: 'https://signed.example/first.png' });
        getDownloadUrl.mockImplementationOnce(() => new Promise(() => undefined));
        const first: ConversationOutputAsset = {
            id: 'asset-1',
            kind: 'image',
            mime_type: 'image/png',
            storage: { type: 'external', resolver: 'google_uri', locator: { uri: 'gs://bucket/first.png' } },
            provenance: { type: 'generated', generation_id: 'generation-1' },
            created_at: RECORDED_AT,
        };
        const second: ConversationOutputAsset = {
            ...first,
            id: 'asset-2',
            storage: { type: 'external', resolver: 'google_uri', locator: { uri: 'gs://bucket/second.png' } },
        };
        const committed: Array<string | undefined> = [];
        const view = render(
            <ObserveCommittedMedia
                fragment={fragment([{ id: 'image-1', type: 'image', asset_id: first.id, caption: 'chart' }], {
                    [first.id]: first,
                })}
                onCommit={(source) => committed.push(source)}
            />,
        );
        await waitFor(() =>
            expect(screen.getByRole('img', { name: 'chart' }).getAttribute('src')).toBe(
                'https://signed.example/first.png',
            ),
        );

        const firstCommitAfterSwitch = committed.length;
        view.rerender(
            <ObserveCommittedMedia
                fragment={fragment([{ id: 'image-1', type: 'image', asset_id: second.id, caption: 'chart' }], {
                    [second.id]: second,
                })}
                onCommit={(source) => committed.push(source)}
            />,
        );

        expect(committed[firstCommitAfterSwitch]).toBeUndefined();
    });

    it('never commits a signed URL resolved by a prior client identity', async () => {
        getDownloadUrl.mockResolvedValueOnce({ url: 'https://signed.example/first-client.png' });
        const stored: ConversationOutputAsset = {
            id: 'asset-1',
            kind: 'image',
            mime_type: 'image/png',
            storage: { type: 'external', resolver: 'google_uri', locator: { uri: 'gs://bucket/image.png' } },
            provenance: { type: 'generated', generation_id: 'generation-1' },
            created_at: RECORDED_AT,
        };
        const output = fragment([{ id: 'image-1', type: 'image', asset_id: stored.id, caption: 'chart' }], {
            [stored.id]: stored,
        });
        const committed: Array<string | undefined> = [];
        const view = render(<ObserveCommittedMedia fragment={output} onCommit={(source) => committed.push(source)} />);
        await waitFor(() =>
            expect(screen.getByRole('img', { name: 'chart' }).getAttribute('src')).toBe(
                'https://signed.example/first-client.png',
            ),
        );

        sessionClient = { objects: { getDownloadUrl: vi.fn(() => new Promise(() => undefined)) } };
        const firstCommitAfterSwitch = committed.length;
        view.rerender(<ObserveCommittedMedia fragment={output} onCommit={(source) => committed.push(source)} />);

        expect(committed[firstCommitAfterSwitch]).toBeUndefined();
    });
});
