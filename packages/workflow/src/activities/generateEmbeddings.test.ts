import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import {
    ContentEventName,
    type ContentObject,
    type DSLActivityExecutionPayload,
    SupportedEmbeddingTypes,
} from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { generateEmbeddings, type GenerateEmbeddingsParams } from './generateEmbeddings.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
});

const createPayload = (params: GenerateEmbeddingsParams): DSLActivityExecutionPayload<GenerateEmbeddingsParams> => {
    const activityParams: GenerateEmbeddingsParams & Record<string, unknown> = { ...params };
    return {
        auth_token: 'mock-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params,
        config: { studio_url: 'http://mock-studio', store_url: 'http://mock-store' },
        workflow_name: 'StandardDocumentIntake',
        event: ContentEventName.create,
        objectIds: ['properties-only-object'],
        input: { inputType: 'objectIds', objectIds: ['properties-only-object'] },
        vars: {},
        activity: { name: 'generateEmbeddings', params: activityParams },
    };
};

describe('generateEmbeddings', () => {
    it('should generate property embeddings for an object without content', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const document = {
            id: 'properties-only-object',
            properties: {
                title: 'Properties-only object',
                category: 'metadata',
            },
        } satisfies Partial<ContentObject>;
        const embeddingResponse = {
            model: 'embedding-model',
            results: [{ outputs: [{ values: [0.1, 0.2, 0.3] }] }],
        };
        const client = {
            objects: {
                retrieve: vi.fn().mockResolvedValue(document),
                setEmbedding: vi.fn().mockResolvedValue(undefined),
            },
            environments: {
                embeddings: vi.fn().mockResolvedValue(embeddingResponse),
            },
        } as unknown as VertesiaClient;
        const params = {
            type: SupportedEmbeddingTypes.properties,
            force: false,
        } satisfies GenerateEmbeddingsParams;

        vi.mocked(setupActivity).mockResolvedValue({
            client,
            objectId: document.id,
            params,
            fetchProject: vi.fn().mockResolvedValue({
                name: 'Test Project',
                namespace: 'test-project',
                configuration: {
                    embeddings: {
                        [SupportedEmbeddingTypes.properties]: {
                            enabled: true,
                            environment: 'test-environment',
                            max_tokens: 8000,
                        },
                    },
                },
            }),
        } as unknown as ActivityContext<GenerateEmbeddingsParams>);

        const result = await testEnv.run(generateEmbeddings, createPayload(params));

        expect(result).toEqual({
            id: document.id,
            type: SupportedEmbeddingTypes.properties,
            status: 'completed',
            len: 3,
        });
        expect(client.objects.retrieve).toHaveBeenCalledWith(
            document.id,
            '+text +parts +embeddings +tokens +properties',
        );
        expect(client.environments.embeddings).toHaveBeenCalledWith('test-environment', {
            inputs: [{ type: 'text', text: JSON.stringify(document.properties) }],
            model: undefined,
        });
        expect(client.objects.setEmbedding).toHaveBeenCalledWith(document.id, SupportedEmbeddingTypes.properties, {
            values: embeddingResponse.results[0].outputs[0].values,
            model: embeddingResponse.model,
            etag: expect.any(String),
        });
    });
});
