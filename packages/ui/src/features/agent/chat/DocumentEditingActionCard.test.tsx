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

        expect(screen.getByRole('region', { name: 'Document edit request' })).not.toBeNull();
        expect(screen.getByText('Add one concrete example.')).not.toBeNull();
        expect(screen.getByText('list item')).not.toBeNull();
        expect(screen.getByText('Launch plan')).not.toBeNull();
        expect(screen.queryByText('operation-1')).toBeNull();
    });

    it('rejects malformed editing metadata', () => {
        expect(parseMarkdownEditingAction({ action: 'comment' })).toBeUndefined();
    });
});
