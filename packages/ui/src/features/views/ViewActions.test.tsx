import { cleanup, screen } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { ContentObjectStatus, type ViewExecutionResult, type ViewHit } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import type { ViewSelectionController } from './types.js';
import { ViewActionsProvider, ViewActionsToolbar } from './ViewActions.js';

const hit: ViewHit = {
    id: 'document-1',
    document: {
        id: 'document-1',
        name: 'Invoice',
        created_at: '2026-01-01T00:00:00.000Z',
        created_by: 'user-1',
        updated_at: '2026-01-01T00:00:00.000Z',
        updated_by: 'user-1',
        location: '/Invoices',
        status: ContentObjectStatus.completed,
        properties: {},
        revision: { root: 'document-1', head: true },
    },
};

const result: ViewExecutionResult = {
    view: 'invoices',
    revision: 1,
    definition: {
        name: 'Invoices',
        results: {
            default_display: 'list',
            selection: { mode: 'multiple' },
            actions: { include_defaults: true },
            displays: [{ id: 'list', label: 'List', type: 'list', title: { field: 'name' } }],
        },
    },
    display: 'list',
    search: { requested_mode: 'browse', applied_mode: 'browse', warnings: [] },
    hits: [hit],
    total: 1,
    navigation: {},
    took: 1,
};

const selection: ViewSelectionController = {
    mode: 'multiple',
    selectAll: false,
    selectedIds: [hit.id],
    selectedHits: [hit],
    isSelected: (id) => id === hit.id,
    toggle: vi.fn(),
    togglePage: vi.fn(),
    clear: vi.fn(),
};

describe('ViewActionsProvider', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('enables the standard export and permission-gated delete actions', () => {
        renderWithProviders(
            <ViewActionsProvider
                definition={result.definition}
                request={{}}
                result={result}
                selection={selection}
                client={{} as VertesiaClient}
                canDelete
                refresh={vi.fn()}
            >
                <ViewActionsToolbar selection={selection} page={result.hits} />
            </ViewActionsProvider>,
        );

        expect(screen.getByRole('button', { name: /export/i })).not.toBeNull();
        expect(screen.getByRole('button', { name: /delete/i })).not.toBeNull();
    });
});
