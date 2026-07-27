import { MockActivityEnvironment } from '@temporalio/testing';
import { EVENT_BUS_REQUEST_ORIGIN, type WorkflowExecutionBaseParams } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { getVertesiaClientOptions } from './client.js';

const TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature';

function payload(requestOrigin?: typeof EVENT_BUS_REQUEST_ORIGIN): WorkflowExecutionBaseParams {
    return {
        account_id: 'account-1',
        project_id: 'project-1',
        auth_token: TOKEN,
        config: { studio_url: 'https://studio.example.com', store_url: 'https://store.example.com' },
        vars: {},
        request_origin: requestOrigin,
    };
}

async function captureEventRequestIds(input: WorkflowExecutionBaseParams): Promise<string[]> {
    const options = getVertesiaClientOptions(input);
    const requests = [new Request('https://studio.example.com/one'), new Request('https://store.example.com/two')];
    for (const request of requests) options.onRequest?.(request);
    expect(requests.every((request) => request.headers.get('x-vertesia-request-origin') === 'event_bus')).toBe(true);
    return requests.map((request) => request.headers.get('x-request-id') ?? '');
}

function assertStringArray(value: unknown): asserts value is string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error('Activity result is not a string array');
    }
}

describe('event workflow API request provenance', () => {
    it('does not mark direct workflow requests', () => {
        expect(getVertesiaClientOptions(payload()).onRequest).toBeUndefined();
    });

    it('uses deterministic per-activity request ids that restart from the same sequence on retry', async () => {
        const environment = new MockActivityEnvironment();
        const firstAttempt = await environment.run(captureEventRequestIds, payload(EVENT_BUS_REQUEST_ORIGIN));
        const retryAttempt = await environment.run(captureEventRequestIds, payload(EVENT_BUS_REQUEST_ORIGIN));
        assertStringArray(firstAttempt);
        assertStringArray(retryAttempt);

        expect(firstAttempt).toEqual(retryAttempt);
        expect(firstAttempt[0]).toMatch(/:0$/);
        expect(firstAttempt[1]).toMatch(/:1$/);
    });
});
