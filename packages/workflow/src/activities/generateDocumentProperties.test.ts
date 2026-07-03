import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import {
    ContentEventName,
    type DSLActivityExecutionPayload,
    PDF_RENDITION_NAME,
    type Rendition,
} from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { executeInteractionFromActivity } from './executeInteraction.js';
import {
    type GenerateDocumentPropertiesParams,
    type GenerateDocumentPropertiesResult,
    generateDocumentProperties,
} from './generateDocumentProperties.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

vi.mock('./executeInteraction.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./executeInteraction.js')>();
    return { ...actual, executeInteractionFromActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
});

function mockExtractionResult(properties: Record<string, unknown>) {
    vi.mocked(executeInteractionFromActivity).mockResolvedValue({
        id: 'run-1',
        modelId: 'model-1',
        result: {
            object: vi.fn(() => properties),
        },
    } as unknown as Awaited<ReturnType<typeof executeInteractionFromActivity>>);
}

function payload(
    params: GenerateDocumentPropertiesParams,
): DSLActivityExecutionPayload<GenerateDocumentPropertiesParams> {
    return {
        auth_token: 'mock-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params,
        config: { studio_url: 'http://mock-studio', store_url: 'http://mock-store' },
        workflow_name: 'test-workflow',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        input: { inputType: 'objectIds', objectIds: ['object-1'] },
        vars: {},
        activity: { name: 'generateDocumentProperties', params: {} },
    };
}

async function mockSetup(options: {
    text?: string;
    contentType?: string;
    objectSchema?: Record<string, unknown>;
    renditions?: Rendition[];
}) {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const update = vi.fn(async () => ({}));
    const retrieveObject = vi.fn(async () => ({
        id: 'object-1',
        text: options.text,
        text_etag: 'source-etag',
        content: {
            type: options.contentType,
        },
        metadata: {
            renditions: options.renditions,
        },
        type: { id: 'type-1', name: 'Invoice', ref_type: 'stored' },
    }));
    const resolveType = vi.fn(async () => ({
        id: 'type-1',
        name: 'Invoice',
        object_schema: options.objectSchema ?? {
            type: 'object',
            properties: {
                title: { type: 'string' },
            },
        },
    }));

    vi.mocked(setupActivity).mockImplementation(
        async (activityPayload) =>
            ({
                objectId: 'object-1',
                params: activityPayload.params,
                fetchProject: vi.fn(async () => ({ configuration: {} })),
                client: {
                    objects: {
                        retrieve: retrieveObject,
                        update,
                    },
                    types: {
                        catalog: {
                            resolve: resolveType,
                        },
                    },
                } as unknown as VertesiaClient,
            }) as unknown as ActivityContext<GenerateDocumentPropertiesParams>,
    );

    return { retrieveObject, resolveType, update };
}

describe('generateDocumentProperties', () => {
    it('does not execute extraction when no text or supported vision source is available', async () => {
        await mockSetup({
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(
            generateDocumentProperties,
            payload({ source: 'vision' }),
        );

        expect(result).toEqual({ status: 'failed', error: 'no-source' });
        expect(executeInteractionFromActivity).not.toHaveBeenCalled();
    });

    it('uses a PDF rendition as vision evidence for non-visual source documents', async () => {
        const pdfRendition = {
            name: PDF_RENDITION_NAME,
            content: {
                name: 'slides.pdf',
                source: 'renditions/source-etag/slides.pdf',
                type: 'application/pdf',
            },
        };
        await mockSetup({
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            renditions: [pdfRendition],
        });
        mockExtractionResult({ title: 'Presentation' });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(
            generateDocumentProperties,
            payload({ source: 'vision' }),
        );

        expect(result).toEqual({ status: 'completed' });
        expect(executeInteractionFromActivity).toHaveBeenCalledWith(
            expect.anything(),
            'sys:ExtractInformation',
            expect.anything(),
            expect.objectContaining({
                content: undefined,
                image: pdfRendition.content,
            }),
            false,
        );
    });

    it.each([
        {
            source: 'auto' as const,
            text: 'PDF text content',
            expectedContent: 'PDF text content',
            expectedImage: undefined,
        },
        { source: 'auto' as const, text: undefined, expectedContent: undefined, expectedImage: 'store:object-1' },
        {
            source: 'text' as const,
            text: 'PDF text content',
            expectedContent: 'PDF text content',
            expectedImage: undefined,
        },
        {
            source: 'vision' as const,
            text: 'PDF text content',
            expectedContent: undefined,
            expectedImage: 'store:object-1',
        },
        { source: 'vision' as const, text: undefined, expectedContent: undefined, expectedImage: 'store:object-1' },
        {
            source: 'mixed' as const,
            text: 'PDF text content',
            expectedContent: 'PDF text content',
            expectedImage: 'store:object-1',
        },
        { source: 'mixed' as const, text: undefined, expectedContent: undefined, expectedImage: 'store:object-1' },
    ])('uses $source extraction source with text=$text', async ({ source, text, expectedContent, expectedImage }) => {
        await mockSetup({
            text,
            contentType: 'application/pdf',
        });
        mockExtractionResult({ title: source });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(
            generateDocumentProperties,
            payload({ source }),
        );

        expect(result).toEqual({ status: 'completed' });
        expect(executeInteractionFromActivity).toHaveBeenCalledWith(
            expect.anything(),
            'sys:ExtractInformation',
            expect.anything(),
            expect.objectContaining({
                content: expectedContent,
                image: expectedImage,
            }),
            false,
        );
    });

    it.each([
        { source: 'text' as const, text: undefined },
        { source: 'text' as const, text: '   ' },
    ])('fails for $source extraction when text is absent or whitespace-only', async ({ source, text }) => {
        await mockSetup({
            text,
            contentType: 'application/pdf',
        });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(
            generateDocumentProperties,
            payload({ source }),
        );

        expect(result).toEqual({ status: 'failed', error: 'no-source' });
        expect(executeInteractionFromActivity).not.toHaveBeenCalled();
    });

    it('accepts deprecated use_vision as a mixed source alias', async () => {
        await mockSetup({
            text: 'PDF text content',
            contentType: 'application/pdf',
        });
        mockExtractionResult({ title: 'Mixed alias' });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(
            generateDocumentProperties,
            payload({ use_vision: true }),
        );

        expect(result).toEqual({ status: 'completed' });
        expect(executeInteractionFromActivity).toHaveBeenCalledWith(
            expect.anything(),
            'sys:ExtractInformation',
            expect.anything(),
            expect.objectContaining({
                content: 'PDF text content',
                image: 'store:object-1',
            }),
            false,
        );
    });

    it('updates properties without writing title or description into object text', async () => {
        const { update } = await mockSetup({
            text: 'source text',
            contentType: 'text/plain',
        });
        mockExtractionResult({ title: 'Statement', description: 'Summary' });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(generateDocumentProperties, payload({}));

        expect(result).toEqual({ status: 'completed' });
        expect(update).toHaveBeenCalledWith(
            'object-1',
            expect.not.objectContaining({
                text: expect.anything(),
            }),
            { suppressWorkflows: true },
        );
        expect(update).toHaveBeenCalledWith(
            'object-1',
            expect.objectContaining({
                properties: {
                    title: 'Statement',
                    description: 'Summary',
                },
            }),
            { suppressWorkflows: true },
        );
    });
});
