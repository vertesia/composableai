import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import {
    ContentEventName,
    type DSLActivityExecutionPayload,
    type GenerationRunMetadata,
    PDF_RENDITION_NAME,
    type Rendition,
} from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { executeInteractionFromActivity } from './executeInteraction.js';
import {
    computeExtractionFingerprint,
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
    vars: Record<string, unknown> = {},
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
        vars,
        activity: { name: 'generateDocumentProperties', params: {} },
    };
}

const DEFAULT_OBJECT_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
    },
};

async function mockSetup(options: {
    text?: string;
    contentType?: string;
    contentEtag?: string;
    objectSchema?: Record<string, unknown>;
    renditions?: Rendition[];
    properties?: Record<string, unknown>;
    generationRuns?: GenerationRunMetadata[];
}) {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const update = vi.fn(async () => ({}));
    const retrieveObject = vi.fn(async () => ({
        id: 'object-1',
        text: options.text,
        text_etag: 'source-etag',
        properties: options.properties,
        content: {
            type: options.contentType,
            etag: options.contentEtag,
        },
        metadata: {
            renditions: options.renditions,
            generation_runs: options.generationRuns,
        },
        type: { id: 'type-1', name: 'Invoice', ref_type: 'stored' },
    }));
    const resolveType = vi.fn(async () => ({
        id: 'type-1',
        name: 'Invoice',
        object_schema: options.objectSchema ?? DEFAULT_OBJECT_SCHEMA,
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

    describe('scoped vision evidence (evidence_images contract)', () => {
        const evidence = [
            { source: 'vision/etag-1/standard/page-7.jpeg', type: 'image/jpeg', name: 'page-7.jpeg' },
            { source: 'vision/etag-1/standard/page-3.jpeg', type: 'image/jpeg', name: 'page-3.jpeg' },
        ];

        it('sends scratch page refs as images and never the store ref for vision', async () => {
            await mockSetup({ text: 'PDF text content', contentType: 'application/pdf' });
            mockExtractionResult({ title: 'Scoped' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ source: 'vision', evidence_images: evidence }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalledWith(
                expect.anything(),
                'sys:ExtractInformation',
                expect.anything(),
                expect.objectContaining({
                    content: undefined,
                    image: undefined,
                    images: evidence,
                }),
                false,
            );
        });

        it('sends text AND scratch page refs for mixed', async () => {
            await mockSetup({ text: 'PDF text content', contentType: 'application/pdf' });
            mockExtractionResult({ title: 'Mixed scoped' });

            await testEnv.run(generateDocumentProperties, payload({ source: 'mixed', evidence_images: evidence }));

            expect(executeInteractionFromActivity).toHaveBeenCalledWith(
                expect.anything(),
                'sys:ExtractInformation',
                expect.anything(),
                expect.objectContaining({
                    content: 'PDF text content',
                    image: undefined,
                    images: evidence,
                }),
                false,
            );
        });

        it('fails with no-source (no store-ref fallback) when the provided evidence is empty and no text exists', async () => {
            await mockSetup({ contentType: 'application/pdf' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ source: 'vision', evidence_images: [] }),
            );

            expect(result).toEqual({ status: 'failed', error: 'no-source' });
            expect(executeInteractionFromActivity).not.toHaveBeenCalled();
        });

        it('extracts from text only when the provided evidence is empty for mixed', async () => {
            await mockSetup({ text: 'PDF text content', contentType: 'application/pdf' });
            mockExtractionResult({ title: 'Text only' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ source: 'mixed', evidence_images: [] }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalledWith(
                expect.anything(),
                'sys:ExtractInformation',
                expect.anything(),
                expect.objectContaining({
                    content: 'PDF text content',
                    image: undefined,
                    images: undefined,
                }),
                false,
            );
        });

        it('ignores evidence images for the text source', async () => {
            await mockSetup({ text: 'PDF text content', contentType: 'application/pdf' });
            mockExtractionResult({ title: 'Text' });

            await testEnv.run(generateDocumentProperties, payload({ source: 'text', evidence_images: evidence }));

            expect(executeInteractionFromActivity).toHaveBeenCalledWith(
                expect.anything(),
                'sys:ExtractInformation',
                expect.anything(),
                expect.objectContaining({
                    content: 'PDF text content',
                    image: undefined,
                    images: undefined,
                }),
                false,
            );
        });

        it('folds the evidence refs into the extraction fingerprint (absent = legacy hash)', () => {
            const base = {
                content_etag: 'etag-1',
                type_id: 'type-1',
                source: 'vision' as const,
                interactionName: 'sys:ExtractInformation',
                object_schema: DEFAULT_OBJECT_SCHEMA,
            };
            const legacy = computeExtractionFingerprint(base);
            const withEvidence = computeExtractionFingerprint({
                ...base,
                evidence: ['vision/etag-1/standard/page-7.jpeg'],
            });
            const withOtherEvidence = computeExtractionFingerprint({
                ...base,
                evidence: ['vision/etag-1/high/page-7.jpeg'],
            });
            expect(withEvidence).not.toBe(legacy);
            expect(withEvidence).not.toBe(withOtherEvidence);
            // undefined evidence must keep previously stored legacy hashes valid
            expect(computeExtractionFingerprint({ ...base, evidence: undefined })).toBe(legacy);
        });
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

    it('clears stale extractable properties omitted by re-extraction while preserving non-extractable fields', async () => {
        const { update } = await mockSetup({
            text: 'source text',
            contentType: 'text/plain',
            properties: {
                po_number: 'STALE-HALLUCINATION',
                total: 10,
                match_id: 'erp-123',
            },
            objectSchema: {
                type: 'object',
                properties: {
                    po_number: { type: 'string' },
                    total: { type: 'number' },
                    match_id: { type: 'string', 'x-extract': false },
                },
            },
        });
        mockExtractionResult({ total: 12 });

        const result: GenerateDocumentPropertiesResult = await testEnv.run(generateDocumentProperties, payload({}));

        expect(result).toEqual({ status: 'completed' });
        expect(update).toHaveBeenCalledWith(
            'object-1',
            expect.objectContaining({
                properties: {
                    total: 12,
                    match_id: 'erp-123',
                },
            }),
            { suppressWorkflows: true },
        );
    });

    describe('skip_if_fresh freshness guard', () => {
        const CONTENT_ETAG = 'content-etag-1';
        const freshFingerprint = computeExtractionFingerprint({
            content_etag: CONTENT_ETAG,
            type_id: 'type-1',
            source: 'auto',
            instructions: undefined,
            interactionName: 'sys:ExtractInformation',
            object_schema: DEFAULT_OBJECT_SCHEMA,
            // the mocked document carries text_etag 'source-etag'; text-consuming
            // extraction fingerprints include it (text can change under one content etag)
            text_etag: 'source-etag',
        });

        function freshSetupOptions(overrides: Parameters<typeof mockSetup>[0] = {}) {
            return {
                text: 'source text',
                contentType: 'text/plain',
                contentEtag: CONTENT_ETAG,
                properties: { title: 'Statement' },
                generationRuns: [
                    {
                        id: 'run-0',
                        date: '2026-01-01T00:00:00.000Z',
                        model: 'model-1',
                        extraction_fingerprint: freshFingerprint,
                    },
                ],
                ...overrides,
            };
        }

        it('skips extraction when the stored fingerprint matches and properties are present', async () => {
            const { update } = await mockSetup(freshSetupOptions());

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }),
            );

            expect(result).toEqual({
                document: 'object-1',
                status: 'skipped',
                message: expect.stringContaining('fresh'),
            });
            expect(executeInteractionFromActivity).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });

        it('scans backwards past generation runs written without a fingerprint', async () => {
            await mockSetup(
                freshSetupOptions({
                    generationRuns: [
                        {
                            id: 'run-0',
                            date: '2026-01-01T00:00:00.000Z',
                            model: 'model-1',
                            extraction_fingerprint: freshFingerprint,
                        },
                        { id: 'run-1', date: '2026-01-02T00:00:00.000Z', model: 'model-2' },
                    ],
                }),
            );

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }),
            );

            expect(result).toMatchObject({ status: 'skipped' });
            expect(executeInteractionFromActivity).not.toHaveBeenCalled();
        });

        it('re-extracts by default: the guard is opt-in', async () => {
            await mockSetup(freshSetupOptions());
            mockExtractionResult({ title: 'Statement' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(generateDocumentProperties, payload({}));

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalled();
        });

        it('re-extracts when the stored fingerprint is stale', async () => {
            await mockSetup(
                freshSetupOptions({
                    generationRuns: [
                        {
                            id: 'run-0',
                            date: '2026-01-01T00:00:00.000Z',
                            model: 'model-1',
                            extraction_fingerprint: 'stale-fingerprint',
                        },
                    ],
                }),
            );
            mockExtractionResult({ title: 'Statement' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalled();
        });

        it('re-extracts when the type schema changed under the same type id', async () => {
            await mockSetup(
                freshSetupOptions({
                    objectSchema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            total: { type: 'number' },
                        },
                    },
                }),
            );
            mockExtractionResult({ title: 'Statement', total: 12 });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalled();
        });

        it('re-extracts when the fingerprint matches but the object has no properties', async () => {
            await mockSetup(freshSetupOptions({ properties: {} }));
            mockExtractionResult({ title: 'Statement' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalled();
        });

        it('re-extracts when payload vars carry forceGeneration', async () => {
            await mockSetup(freshSetupOptions());
            mockExtractionResult({ title: 'Statement' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }, { forceGeneration: true }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(executeInteractionFromActivity).toHaveBeenCalled();
        });

        it('persists the extraction fingerprint in the generation run info after a successful extraction', async () => {
            const { update } = await mockSetup(freshSetupOptions({ generationRuns: undefined }));
            mockExtractionResult({ title: 'Statement' });

            const result: GenerateDocumentPropertiesResult = await testEnv.run(
                generateDocumentProperties,
                payload({ skip_if_fresh: true }),
            );

            expect(result).toEqual({ status: 'completed' });
            expect(update).toHaveBeenCalledWith(
                'object-1',
                expect.objectContaining({
                    generation_run_info: expect.objectContaining({
                        extraction_fingerprint: freshFingerprint,
                    }),
                }),
                { suppressWorkflows: true },
            );
        });
    });
});
