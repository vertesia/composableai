import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { DeleteMemoryBrainQuery, DeleteMemoryBrainResponse } from '@vertesia/common';

/**
 * Administration of Memory Brains and the record namespaces they own.
 */
export class MemoryApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/memory');
    }

    /**
     * Delete a Memory Brain definition and, with `purge_records: true`, every record in its
     * namespace — that is every content object whose `properties.brain_id` equals `brainId`.
     *
     * The summary reports partial failures rather than the call failing outright, so a caller can
     * retry the remainder.
     *
     * @param brainId the `brain_id` of the Brain, not the content object id
     * @param options cascade and content-type-naming overrides
     */
    deleteBrain(brainId: string, options: DeleteMemoryBrainQuery = {}): Promise<DeleteMemoryBrainResponse> {
        return this.del(`/brains/${encodeURIComponent(brainId)}`, { query: options });
    }
}
