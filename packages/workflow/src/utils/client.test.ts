import { MockActivityEnvironment } from '@temporalio/testing';
import {
    BULK_IMPORT_REQUEST_ORIGIN,
    EVENT_BUS_REQUEST_ORIGIN,
    type WorkflowExecutionBaseParams,
    type WorkflowRequestOrigin,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { getVertesiaClientOptions } from './client.js';

const TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature';

function payload(requestOrigin?: WorkflowRequestOrigin): WorkflowExecutionBaseParams {
    return {
        account_id: 'account-1',
        project_id: 'project-1',
        auth_token: TOKEN,
        config: { studio_url: 'https://studio.example.com', store_url: 'https://store.example.com' },
        vars: {},
        request_origin: requestOrigin,
    };
}

async function captureRequestIdentity(input: WorkflowExecutionBaseParams): Promise<{
    origin: Array<string | null>;
    requestIds: string[];
}> {
    const options = getVertesiaClientOptions(input);
    const requests = [new Request('https://studio.example.com/one'), new Request('https://store.example.com/two')];
    for (const request of requests) options.onRequest?.(request);
    return {
        origin: requests.map((request) => request.headers.get('x-vertesia-request-origin')),
        requestIds: requests.map((request) => request.headers.get('x-request-id') ?? ''),
    };
}

function assertRequestIdentity(value: unknown): asserts value is Awaited<ReturnType<typeof captureRequestIdentity>> {
    if (
        !value ||
        typeof value !== 'object' ||
        !('requestIds' in value) ||
        !Array.isArray(value.requestIds) ||
        value.requestIds.some((item) => typeof item !== 'string')
    ) {
        throw new Error('Activity result does not contain request identity');
    }
}

describe('workflow API request provenance', () => {
    it('does not mark non-activity utility requests', () => {
        const options = getVertesiaClientOptions(payload());
        expect(options.onRequest).toBeUndefined();
    });

    it.each([undefined, EVENT_BUS_REQUEST_ORIGIN, BULK_IMPORT_REQUEST_ORIGIN])(
        'uses deterministic per-activity request ids for origin %s',
        async (origin) => {
            const environment = new MockActivityEnvironment();
            const firstAttempt = await environment.run(captureRequestIdentity, payload(origin));
            const retryAttempt = await environment.run(captureRequestIdentity, payload(origin));
            assertRequestIdentity(firstAttempt);
            assertRequestIdentity(retryAttempt);

            expect(firstAttempt).toEqual(retryAttempt);
            expect(firstAttempt.origin).toEqual([origin ?? null, origin ?? null]);
            expect(firstAttempt.requestIds[0]).toMatch(/:0$/);
            expect(firstAttempt.requestIds[1]).toMatch(/:1$/);
        },
    );
});
