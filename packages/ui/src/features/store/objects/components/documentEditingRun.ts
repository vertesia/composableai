import type { AgentsApi } from '@vertesia/client';
import type { AgentRun } from '@vertesia/common';

const DOCUMENT_EDITING_TAG = 'document-editing';
const DOCUMENT_ROOT_TAG_PREFIX = 'document-root:';
const LEGACY_DOCUMENT_TAG_PREFIX = 'document:';
const DOCUMENT_EDITING_INTERACTION = 'sys:GeneralAgent';

export type DocumentEditingRunProperties = {
    resource_kind: 'store_document';
    document_id: string;
    document_root_id: string;
};

export interface DocumentEditingRunIdentity {
    tags: string[];
    properties: DocumentEditingRunProperties;
}

type DocumentEditingRunApi = Pick<AgentsApi, 'list' | 'retrieve' | 'search'>;

function getRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function documentRootTag(documentRootId: string): string {
    return `${DOCUMENT_ROOT_TAG_PREFIX}${documentRootId}`;
}

function legacyDocumentTag(documentId: string): string {
    return `${LEGACY_DOCUMENT_TAG_PREFIX}${documentId}`;
}

export function createDocumentEditingRunIdentity(
    documentId: string,
    documentRootId: string,
): DocumentEditingRunIdentity {
    return {
        tags: [DOCUMENT_EDITING_TAG, documentRootTag(documentRootId), legacyDocumentTag(documentId)],
        properties: {
            resource_kind: 'store_document',
            document_id: documentId,
            document_root_id: documentRootId,
        },
    };
}

export function getDocumentTextActionAccess(canEdit: boolean, canCollaborate: boolean) {
    return {
        canEdit,
        canCollaborate,
    };
}

export function isDocumentEditingRun(
    run: AgentRun,
    documentId: string,
    documentRootId: string,
    startedBy: string,
): boolean {
    if (run.interaction !== DOCUMENT_EDITING_INTERACTION || run.started_by !== startedBy) return false;

    const tags = run.tags ?? [];
    if (!tags.includes(DOCUMENT_EDITING_TAG)) return false;

    const properties = getRecord(run.properties);
    const matchesStableIdentity =
        tags.includes(documentRootTag(documentRootId)) &&
        properties?.resource_kind === 'store_document' &&
        properties.document_root_id === documentRootId;
    if (matchesStableIdentity) return true;

    // Runs created before stable root properties were added only carry a document tag.
    return tags.includes(legacyDocumentTag(documentRootId)) || tags.includes(legacyDocumentTag(documentId));
}

async function retrieveMatchingRun(
    agents: DocumentEditingRunApi,
    runIds: string[],
    documentId: string,
    documentRootId: string,
    startedBy: string,
): Promise<AgentRun | undefined> {
    for (const runId of runIds) {
        try {
            const run = await agents.retrieve(runId);
            if (isDocumentEditingRun(run, documentId, documentRootId, startedBy)) return run;
        } catch {
            // The run may have been deleted between search and retrieval. Try the next candidate.
        }
    }
    return undefined;
}

export async function findDocumentEditingRun(
    agents: DocumentEditingRunApi,
    documentId: string,
    documentRootId: string,
    startedBy: string,
): Promise<AgentRun | undefined> {
    const lookupTags = [
        documentRootTag(documentRootId),
        legacyDocumentTag(documentRootId),
        legacyDocumentTag(documentId),
    ];
    const searchedRunIds = new Set<string>();

    for (const tag of new Set(lookupTags)) {
        try {
            const response = await agents.search({
                interaction: DOCUMENT_EDITING_INTERACTION,
                started_by: startedBy,
                tags: [tag],
                limit: 20,
                sort: ['updated_at:desc'],
            });
            const candidateIds = response.hits.map((hit) => hit.id).filter((id) => !searchedRunIds.has(id));
            for (const id of candidateIds) {
                searchedRunIds.add(id);
            }
            const run = await retrieveMatchingRun(agents, candidateIds, documentId, documentRootId, startedBy);
            if (run) return run;
        } catch {
            // Fall through to the authoritative Mongo-backed list lookup below.
            break;
        }
    }

    const response = await agents.list({
        interaction: DOCUMENT_EDITING_INTERACTION,
        started_by: startedBy,
        limit: 100,
        sort: 'updated_at',
        order: 'desc',
    });
    return response.items.find(
        (run): run is AgentRun =>
            run.run_kind === 'agent' && isDocumentEditingRun(run, documentId, documentRootId, startedBy),
    );
}
