/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Element } from 'hast';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/index.js';
import {
    CollaborativeMarkdownRenderer,
    createMarkdownBlockAnchor,
    formatMarkdownEditingAction,
    type MarkdownEditingAction,
} from './CollaborativeMarkdownRenderer.js';

afterEach(() => {
    cleanup();
});

function elementAt(start: number, end: number): Element {
    return {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [],
        position: {
            start: { line: 1, column: start + 1, offset: start },
            end: { line: 1, column: end + 1, offset: end },
        },
    };
}

describe('collaborative Markdown actions', () => {
    it('anchors a block with its range and surrounding source context', () => {
        const markdown = 'Before\n\nSelected paragraph\n\nAfter';
        const start = markdown.indexOf('Selected');
        const end = start + 'Selected paragraph'.length;

        expect(createMarkdownBlockAnchor(markdown, elementAt(start, end), 'paragraph')).toEqual({
            block_id: `paragraph:${start}:${end}`,
            block_type: 'paragraph',
            source_range: { start, end },
            exact_text: 'Selected paragraph',
            prefix: 'Before\n\n',
            suffix: '\n\nAfter',
            occurrence_index: 0,
        });
    });

    it('disambiguates repeated blocks under the same heading', () => {
        const markdown = '# Section\n\nRepeated\n\nRepeated';
        const start = markdown.lastIndexOf('Repeated');
        const end = start + 'Repeated'.length;

        expect(createMarkdownBlockAnchor(markdown, elementAt(start, end), 'paragraph')).toEqual(
            expect.objectContaining({
                heading_path: ['Section'],
                exact_text: 'Repeated',
                occurrence_index: 1,
            }),
        );
    });

    it('formats a direct artifact edit as an actionable agent message', () => {
        const action: MarkdownEditingAction = {
            operation_id: 'operation-1',
            resource: { kind: 'agent_artifact', run_id: 'run-1', path: 'draft.md' },
            base_version: 'etag-1',
            action: 'edit',
            anchor: {
                block_id: 'paragraph:0:3',
                block_type: 'paragraph',
                exact_text: 'Old',
            },
            user_change: { before: 'Old', after: 'New' },
        };

        expect(formatMarkdownEditingAction(action)).toContain('artifact:draft.md (run run-1)');
        expect(formatMarkdownEditingAction(action)).toContain('Before:\n```markdown\nOld');
        expect(formatMarkdownEditingAction(action)).toContain('After:\n```markdown\nNew');
    });

    it('uses a longer message fence when selected source contains a fenced code block', () => {
        const action: MarkdownEditingAction = {
            operation_id: 'operation-1',
            resource: { kind: 'agent_artifact', run_id: 'run-1', path: 'draft.md' },
            action: 'comment',
            anchor: {
                block_id: 'code_block:0:21',
                block_type: 'code_block',
                exact_text: '```ts\nconst n = 1;\n```',
            },
            comment: 'Rename this variable.',
        };

        expect(formatMarkdownEditingAction(action)).toContain(
            'Selected content:\n````markdown\n```ts\nconst n = 1;\n```\n````',
        );
    });

    it('submits a comment with the selected source block and version', async () => {
        const onAction = vi.fn();
        render(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'store_document', document_id: 'document-1' }}
                    baseVersion="etag-1"
                    onAction={onAction}
                >
                    {'First paragraph.\n\nSecond paragraph.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        const selectedBlock = screen.getByText('Second paragraph.').parentElement;
        if (!selectedBlock) throw new Error('Expected the paragraph to have a collaborative block parent');
        fireEvent.click(within(selectedBlock).getByRole('button', { name: 'Comment on selection' }));
        fireEvent.change(within(selectedBlock).getByRole('textbox'), {
            target: { value: 'Make this more specific.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: { kind: 'store_document', document_id: 'document-1' },
                base_version: 'etag-1',
                action: 'comment',
                comment: 'Make this more specific.',
                anchor: expect.objectContaining({
                    block_type: 'paragraph',
                    exact_text: 'Second paragraph.',
                }),
            }),
        );
    });

    it('briefly highlights blocks that changed between document revisions', async () => {
        const onAction = vi.fn();
        const { rerender } = render(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'store_document', document_id: 'document-1' }}
                    onAction={onAction}
                >
                    {'Original paragraph.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        rerender(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'store_document', document_id: 'document-2' }}
                    highlightChangesFrom="Original paragraph."
                    highlightVersion={1}
                    onAction={onAction}
                >
                    {'Updated paragraph.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('Updated paragraph.').parentElement?.className).toContain('bg-mixer-success/15');
        });
    });

    it('preserves a typed draft when a document refresh invalidates its block anchor', async () => {
        const onAction = vi.fn();
        const { rerender } = render(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'store_document', document_id: 'document-1' }}
                    onAction={onAction}
                >
                    {'Original paragraph.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        const selectedBlock = screen.getByText('Original paragraph.').parentElement;
        if (!selectedBlock) throw new Error('Expected a collaborative block parent');
        fireEvent.click(within(selectedBlock).getByRole('button', { name: 'Comment on selection' }));
        fireEvent.change(within(selectedBlock).getByRole('textbox'), {
            target: { value: 'Keep this draft recoverable.' },
        });

        rerender(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'store_document', document_id: 'document-2' }}
                    onAction={onAction}
                >
                    {'Inserted paragraph.\n\nOriginal paragraph.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('Your draft was preserved')).not.toBeNull();
            expect(screen.getByDisplayValue('Keep this draft recoverable.')).not.toBeNull();
        });
    });

    it('keeps source anchors aligned when normal rendering would rewrite earlier Markdown', async () => {
        const onAction = vi.fn();
        render(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'store_document', document_id: 'document-1' }}
                    onAction={onAction}
                >
                    {'Revenue was between $100M and $500M.\n\nKeep this exact.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        const selectedBlock = screen.getByText('Keep this exact.').parentElement;
        if (!selectedBlock) throw new Error('Expected the paragraph to have a collaborative block parent');
        fireEvent.click(within(selectedBlock).getByRole('button', { name: 'Comment on selection' }));
        fireEvent.change(within(selectedBlock).getByRole('textbox'), {
            target: { value: 'Add evidence.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({
                anchor: expect.objectContaining({
                    exact_text: 'Keep this exact.',
                    source_range: {
                        start: 'Revenue was between $100M and $500M.\n\n'.length,
                        end: 'Revenue was between $100M and $500M.\n\nKeep this exact.'.length,
                    },
                }),
            }),
        );
    });

    it('hides editing controls on a read-only surface', () => {
        render(
            <I18nProvider lng="en">
                <CollaborativeMarkdownRenderer
                    resource={{ kind: 'agent_artifact', run_id: 'run-1', path: 'draft.md' }}
                    readOnly
                    onAction={vi.fn()}
                >
                    {'Read only paragraph.'}
                </CollaborativeMarkdownRenderer>
            </I18nProvider>,
        );

        expect(screen.queryByRole('button', { name: 'Comment on selection' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit selection' })).toBeNull();
    });
});
