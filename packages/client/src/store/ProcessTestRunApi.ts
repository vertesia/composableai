import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ProcessTestRun, SubmitProcessTestRunPayload } from '@vertesia/common';

/**
 * Run-scoped process test operations.
 *
 * Test runs are addressed by their own id here, so these methods work for every run whatever it
 * was started against — a stored process test suite, an in-code `app:`/`sys:` process, or an
 * ephemeral definition submitted inline.
 */
export class ProcessTestRunApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/process-test-runs');
    }

    /**
     * Start a test run against an in-code process or an inline definition, with the scenarios
     * supplied in the request instead of a stored suite. Use
     * `client.store.processes.startTestRun()` for stored process definitions and their suites.
     */
    submit(payload: SubmitProcessTestRunPayload): Promise<ProcessTestRun> {
        // Starting a run is not idempotent and the contract carries no request key, so a replay
        // would create a second run. Opt out of any client-level retry policy explicitly rather
        // than relying on POST being absent from its method list. Rate-limiter pacing retries are
        // unaffected: those happen before the request reaches the handler.
        return this.post('/', { payload, retryPolicy: false });
    }

    retrieve(runId: string): Promise<ProcessTestRun> {
        return this.get(`/${runId}`);
    }

    cancel(runId: string): Promise<ProcessTestRun> {
        return this.post(`/${runId}/cancel`, {});
    }

    /** Deletes a run and its snapshot, cancelling it first when it is still active. */
    delete(runId: string): Promise<{ id: string; count: number }> {
        return this.del(`/${runId}`);
    }
}
