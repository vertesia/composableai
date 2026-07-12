import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { BatchReconcileRequest, BatchReconcileResponse } from '@vertesia/common';

export default class InternalBatchesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/internal/batches');
    }

    reconcile(payload: BatchReconcileRequest): Promise<BatchReconcileResponse> {
        return this.post('/reconcile', { payload });
    }
}
