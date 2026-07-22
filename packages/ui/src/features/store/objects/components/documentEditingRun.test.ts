import type { AgentRun } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import {
    createDocumentEditingRunIdentity,
    createDocumentEditingScopeKey,
    findDocumentEditingRun,
    getDocumentTextActionAccess,
    isDocumentEditingRun,
    isDocumentEditingScopeOpen,
    setDocumentEditingScopeOpen,
} from './documentEditingRun.js';

const startedBy = 'user:user-1';

function createRun(overrides: Partial<AgentRun> = {}): AgentRun {
    return {
        id: 'run-1',
        run_kind: 'agent',
        run_type: 'autonomous',
        interaction: 'sys:GeneralAgent',
        interactionRef: { id: 'sys:GeneralAgent' },
        status: 'running',
        started_by: startedBy,
        started_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        ...overrides,
    } as AgentRun;
}

describe('document editing run identity', () => {
    it('keeps the editing panel open across document component remounts', () => {
        const scopeKey = createDocumentEditingScopeKey('project-1', 'document-root');

        setDocumentEditingScopeOpen(scopeKey, true);
        expect(isDocumentEditingScopeOpen(scopeKey)).toBe(true);

        setDocumentEditingScopeOpen(scopeKey, false);
        expect(isDocumentEditingScopeOpen(scopeKey)).toBe(false);
    });

    it('keeps collaboration access independent from direct editing access', () => {
        expect(getDocumentTextActionAccess(false, true)).toEqual({
            canEdit: false,
            canCollaborate: true,
        });
    });

    it('creates stable revision-root tags and properties', () => {
        expect(createDocumentEditingRunIdentity('document-2', 'document-root')).toEqual({
            tags: ['document-editing', 'document-root:document-root', 'document:document-2'],
            properties: {
                resource_kind: 'store_document',
                document_id: 'document-2',
                document_root_id: 'document-root',
            },
        });
    });

    it('requires the same user and matching root properties for stable runs', () => {
        const identity = createDocumentEditingRunIdentity('document-2', 'document-root');
        const run = createRun(identity);

        expect(isDocumentEditingRun(run, 'document-3', 'document-root', startedBy)).toBe(true);
        expect(isDocumentEditingRun(run, 'document-3', 'another-root', startedBy)).toBe(false);
        expect(isDocumentEditingRun(run, 'document-3', 'document-root', 'user:user-2')).toBe(false);
    });

    it('reattaches a legacy document-tagged run owned by the user', () => {
        const run = createRun({ tags: ['document-editing', 'document:document-root'] });

        expect(isDocumentEditingRun(run, 'document-2', 'document-root', startedBy)).toBe(true);
    });

    it('never resumes a run the user terminated', () => {
        const identity = createDocumentEditingRunIdentity('document-2', 'document-root');
        const run = createRun({ ...identity, status: 'cancelled' });

        expect(isDocumentEditingRun(run, 'document-2', 'document-root', startedBy)).toBe(false);
    });

    it('matches the interaction configured for the document type', () => {
        const identity = createDocumentEditingRunIdentity('document-2', 'document-root');
        const run = createRun({ ...identity, interaction: 'custom-editor' });

        expect(isDocumentEditingRun(run, 'document-2', 'document-root', startedBy, 'custom-editor')).toBe(true);
        expect(isDocumentEditingRun(run, 'document-2', 'document-root', startedBy)).toBe(false);
    });
});

describe('findDocumentEditingRun', () => {
    it('searches by root tag and verifies the retrieved run', async () => {
        const identity = createDocumentEditingRunIdentity('document-2', 'document-root');
        const run = createRun(identity);
        const agents = {
            search: vi.fn().mockResolvedValue({
                hits: [{ id: run.id, created_at: '2026-01-01', updated_at: '2026-01-02' }],
                total: 1,
            }),
            retrieve: vi.fn().mockResolvedValue(run),
            list: vi.fn(),
        };

        await expect(findDocumentEditingRun(agents, 'document-2', 'document-root', startedBy)).resolves.toBe(run);
        expect(agents.search).toHaveBeenCalledWith({
            interaction: 'sys:GeneralAgent',
            started_by: startedBy,
            tags: ['document-root:document-root'],
            limit: 20,
            sort: ['updated_at:desc'],
        });
        expect(agents.list).not.toHaveBeenCalled();
    });

    it('falls back to recent user-owned runs when search is unavailable', async () => {
        const run = createRun({ tags: ['document-editing', 'document:document-root'] });
        const agents = {
            search: vi.fn().mockRejectedValue(new Error('search unavailable')),
            retrieve: vi.fn(),
            list: vi.fn().mockResolvedValue({ items: [run], total_count: 1, next_cursor: null }),
        };

        await expect(findDocumentEditingRun(agents, 'document-2', 'document-root', startedBy)).resolves.toBe(run);
        expect(agents.list).toHaveBeenCalledWith({
            interaction: 'sys:GeneralAgent',
            started_by: startedBy,
            limit: 100,
            sort: 'updated_at',
            order: 'desc',
        });
    });

    it('searches and validates runs using a type-specific interaction', async () => {
        const identity = createDocumentEditingRunIdentity('document-2', 'document-root');
        const run = createRun({ ...identity, interaction: 'custom-editor' });
        const agents = {
            search: vi.fn().mockResolvedValue({
                hits: [{ id: run.id, created_at: '2026-01-01', updated_at: '2026-01-02' }],
                total: 1,
            }),
            retrieve: vi.fn().mockResolvedValue(run),
            list: vi.fn(),
        };

        await expect(
            findDocumentEditingRun(agents, 'document-2', 'document-root', startedBy, 'custom-editor'),
        ).resolves.toBe(run);
        expect(agents.search).toHaveBeenCalledWith(
            expect.objectContaining({
                interaction: 'custom-editor',
            }),
        );
    });
});
