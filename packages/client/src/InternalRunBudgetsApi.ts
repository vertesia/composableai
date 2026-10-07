import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ReadRunBudgetUsagePayload, RunBudgetTotals } from '@vertesia/common';

/** Workload-authenticated accounting operations. Ordinary user tokens are not accepted. */
export default class InternalRunBudgetsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/internal/run-budget');
    }

    usage(payload: ReadRunBudgetUsagePayload): Promise<RunBudgetTotals> {
        return this.post('/usage', { payload });
    }
}
