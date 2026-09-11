import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    DeleteSchemaCandidateResponse,
    GenerateSchemaCandidateDraftResponse,
    ListSchemaCandidatesResponse,
    ProposeSchemaCandidatePayload,
    SchemaCandidate,
} from '@vertesia/common';

export default class SchemaCandidatesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/schema-candidates');
    }

    list(): Promise<ListSchemaCandidatesResponse> {
        return this.get('/');
    }

    propose(payload: ProposeSchemaCandidatePayload): Promise<SchemaCandidate> {
        return this.post('/', { payload });
    }

    generateDraft(candidateId: string): Promise<GenerateSchemaCandidateDraftResponse> {
        return this.post(`/${encodeURIComponent(candidateId)}/draft`);
    }

    delete(candidateId: string): Promise<DeleteSchemaCandidateResponse> {
        return this.del(`/${encodeURIComponent(candidateId)}`);
    }
}
