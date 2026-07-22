/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { DocumentEditingActionCard, parseMarkdownEditingAction } from './DocumentEditingActionCard.js';

afterEach(cleanup);

const action = {
    operation_id: 'operation-1',
    resource: { kind: 'store_document', document_id: 'document-1', name: 'Launch plan' },
    action: 'comment',
    anchor: {
        block_id: 'list_item:10:24',
        block_type: 'list_item',
        exact_text: '- Preserve unrelated sections.',
    },
    comment: 'Add one concrete example.',
};

describe('DocumentEditingActionCard', () => {
    it('parses and renders a compact comment card', () => {
        const parsed = parseMarkdownEditingAction(action);
        expect(parsed).toBeDefined();
        if (!parsed) throw new Error('Expected a valid editing action');

        render(
            <I18nProvider lng="en">
                <DocumentEditingActionCard action={parsed} />
            </I18nProvider>,
        );

        expect(screen.getByText('Add one concrete example.')).not.toBeNull();
        expect(screen.getByText('list item')).not.toBeNull();
        expect(screen.getByText('Launch plan')).not.toBeNull();
        expect(screen.queryByText('operation-1')).toBeNull();
    });

    it('renders an applied edit as a saved notification', () => {
        const parsed = parseMarkdownEditingAction({
            operation_id: 'operation-2',
            resource: { kind: 'store_document', document_id: 'document-1', name: 'Launch plan' },
            action: 'edit',
            anchor: {
                block_id: 'list:10:24',
                block_type: 'list',
                exact_text: '- Preserve unrelated sections.',
            },
            user_change: {
                before: '- Preserve unrelated sections.',
                after: '- Preserve unrelated sections.\n- And be fun',
            },
            applied: true,
            updated_document_id: 'document-2',
        });
        expect(parsed).toBeDefined();
        if (!parsed) throw new Error('Expected a valid editing action');
        expect(parsed.applied).toBe(true);
        expect(parsed.updated_document_id).toBe('document-2');

        render(
            <I18nProvider lng="en">
                <DocumentEditingActionCard action={parsed} />
            </I18nProvider>,
        );

        expect(screen.getByText('Edit applied')).not.toBeNull();
        expect(screen.getByText('list')).not.toBeNull();
        expect(screen.getByText('Launch plan')).not.toBeNull();
    });

    it('highlights the change as an inline diff', () => {
        const parsed = parseMarkdownEditingAction({
            operation_id: 'operation-3',
            resource: { kind: 'store_document', document_id: 'document-1', name: 'Launch plan' },
            action: 'edit',
            anchor: {
                block_id: 'paragraph:30:40',
                block_type: 'paragraph',
                exact_text: 'Keep the tone light.',
            },
            user_change: {
                before: 'Keep the tone light.',
                after: 'Keep the tone light. Session edit A.',
            },
        });
        if (!parsed) throw new Error('Expected a valid editing action');

        const { container } = render(
            <I18nProvider lng="en">
                <DocumentEditingActionCard action={parsed} />
            </I18nProvider>,
        );

        const inserted = container.querySelector('ins');
        expect(inserted?.textContent).toBe(' Session edit A.');
        expect(container.querySelector('del')).toBeNull();
        expect(screen.getByText('Keep the tone light.')).not.toBeNull();
    });

    it('rejects malformed editing metadata', () => {
        expect(parseMarkdownEditingAction({ action: 'comment' })).toBeUndefined();
    });
});
