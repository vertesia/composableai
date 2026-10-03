import { describe, expect, test } from 'vitest';
import { ZenoClient } from './client.js';

describe('canonical asset extraction SDK', () => {
    test('uses exact version and encoded source/operation selectors without claimed provenance', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'fixture',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json({ status: 'pending' });
            }) as typeof fetch,
        });
        const controller = new AbortController();
        const payload = { operation_id: 'extract/one', transform: 'document_text/v1' as const };
        await client.agents.extractAsset('subject/one', 'upload/one', payload, { signal: controller.signal });
        await client.agents.getAssetExtraction('subject/one', 'upload/one', 'extract/one', {
            signal: controller.signal,
        });
        expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
            '/api/v1/agents/subject%2Fone/assets/upload%2Fone/extractions',
            '/api/v1/agents/subject%2Fone/assets/upload%2Fone/extractions/extract%2Fone',
        ]);
        expect(await requests[0].json()).toEqual(payload);
        expect(requests.map((request) => request.headers.get('x-api-version'))).toEqual(['=20260930', '=20260930']);
        controller.abort();
        expect(requests.every((request) => request.signal.aborted)).toBe(true);
    });
    test('claim uses exact version, encoded immutable selectors and actual-run assertion only', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'fixture',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json({
                    api_version: '=20260930',
                    subject_agent_run_id: 'subject/one',
                    operation_id: 'extract/one',
                    workflow_id: 'actual-workflow',
                    run_id: 'actual-run',
                });
            }) as typeof fetch,
        });
        const controller = new AbortController();
        const result = await client.agents.claimAssetExtraction(
            'subject/one',
            'upload/one',
            'extract/one',
            { expected_run_id: 'actual-run' },
            { signal: controller.signal },
        );
        expect(new URL(requests[0].url).pathname).toBe(
            '/api/v1/agents/subject%2Fone/assets/upload%2Fone/extractions/extract%2Fone/claim',
        );
        expect(await requests[0].json()).toEqual({ expected_run_id: 'actual-run' });
        expect(requests[0].headers.get('x-api-version')).toBe('=20260930');
        expect(result.run_id).toBe('actual-run');
        controller.abort();
        expect(requests[0].signal.aborted).toBe(true);
    });
});
