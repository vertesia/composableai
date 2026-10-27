import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import {
    ContentEventName,
    type ContentObjectTypeItem,
    type DSLActivityExecutionPayload,
    PDF_RENDITION_NAME,
    type Rendition,
} from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { executeInteractionFromActivity } from './executeInteraction.js';
import {
    type GenerateOrAssignContentTypeParams,
    type GenerateOrAssignContentTypeResult,
    generateOrAssignContentType,
} from './generateOrAssignContentType.js';

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

function payload(
    params: GenerateOrAssignContentTypeParams,
): DSLActivityExecutionPayload<GenerateOrAssignContentTypeParams> {
    return {
        account_id: 'test-account',
        activity: { name: 'generateOrAssignContentType', params: {} },
        auth_token: 'mock-token',
        config: { studio_url: 'http://mock-studio', store_url: 'http://mock-store' },
        event: ContentEventName.create,
        input: { inputType: 'objectIds', objectIds: ['object-1'] },
        objectIds: ['object-1'],
        params,
        project_id: 'test-project',
        vars: {},
        workflow_name: 'test-workflow',
    };
}

function typeItem(name: string, status?: ContentObjectTypeItem['status']): ContentObjectTypeItem {
    return {
        id: `type-${name}`,
        name,
        status,
    } as ContentObjectTypeItem;
}

function mockSelectionResult(documentType: string) {
    vi.mocked(executeInteractionFromActivity).mockResolvedValue({
        id: 'run-1',
        modelId: 'model-1',
        result: {
            object: vi.fn(() => ({ document_type: documentType })),
        },
    } as unknown as Awaited<ReturnType<typeof executeInteractionFromActivity>>);
}

async function mockSetup(
    types: ContentObjectTypeItem[],
    options: {
        contentType?: string;
        renditions?: Rendition[];
        text?: string;
    } = {},
) {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const update = vi.fn(() => Promise.resolve({}));
    const retrieveObject = vi.fn(() =>
        Promise.resolve({
            id: 'object-1',
            content: { type: options.contentType ?? 'text/plain' },
            metadata: { renditions: options.renditions },
            text: options.text ?? 'Document text',
        }),
    );
    const listTypes = vi.fn(() => Promise.resolve(types));
    const createType = vi.fn(() => Promise.resolve({ id: 'type-new', name: 'NewType' }));

    vi.mocked(setupActivity).mockImplementation((activityPayload) =>
        Promise.resolve({
            client: {
                objects: {
                    retrieve: retrieveObject,
                    update,
                },
                types: {
                    catalog: {
                        list: listTypes,
                    },
                    create: createType,
                },
            } as unknown as VertesiaClient,
            fetchProject: vi.fn(() => Promise.resolve({ configuration: {} })),
            objectId: 'object-1',
            params: activityPayload.params,
        } as unknown as ActivityContext<GenerateOrAssignContentTypeParams>),
    );

    return { createType, listTypes, update };
}

describe('generateOrAssignContentType', () => {
    it('keeps the selection schema valid when catalog names and the fallback name repeat', async () => {
        const first = { ...typeItem('Invoice', 'active'), id: 'type-invoice-first' };
        const duplicate = { ...typeItem('Invoice', 'active'), id: 'type-invoice-second' };
        const { update } = await mockSetup([first, duplicate, typeItem('other', 'active')]);
        mockSelectionResult('Invoice');

        await testEnv.run(generateOrAssignContentType, payload({ allowNewContentTypes: false }));

        expect(executeInteractionFromActivity).toHaveBeenCalledWith(
            expect.anything(),
            'sys:SelectDocumentType',
            expect.objectContaining({
                result_schema: expect.objectContaining({
                    properties: {
                        document_type: expect.objectContaining({ enum: ['Invoice', 'other'] }),
                    },
                }),
            }),
            expect.anything(),
        );
        expect(update).toHaveBeenCalledWith('object-1', { type: 'type-invoice-first' }, { suppressWorkflows: true });
    });

    it('assigns an app-contributed type instead of generating a duplicate', async () => {
        // An `app:<app>:<type>` entry in the catalog is a real selection candidate: when the model
        // picks it, the activity must assign it as-is and create nothing. If app-contributed types
        // are missing from the catalog, selection cannot match one and a duplicate stored type gets
        // generated for a document the installed app already had a type for.
        const appType = {
            id: 'app:invoice-app:Invoice',
            name: 'Invoice',
            status: 'active',
        } as ContentObjectTypeItem;
        const { createType, update } = await mockSetup([appType, typeItem('GenericDocument', 'active')]);
        mockSelectionResult('Invoice');

        const result: GenerateOrAssignContentTypeResult = await testEnv.run(
            generateOrAssignContentType,
            payload({ allowNewContentTypes: true }),
        );

        expect(createType).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith(
            'object-1',
            { type: 'app:invoice-app:Invoice' },
            { suppressWorkflows: true },
        );
        expect(result).toEqual({ id: 'app:invoice-app:Invoice', isNew: false, name: 'Invoice' });
    });

    it('excludes draft types from selection and does not assign them if returned by the model', async () => {
        const { update } = await mockSetup([
            typeItem('Invoice', 'active'),
            typeItem('DraftInvoice', 'draft'),
            typeItem('DocumentPart', 'active'),
            typeItem('GenericDocument', 'active'),
            typeItem('Rendition', 'active'),
        ]);
        mockSelectionResult('DraftInvoice');

        const result: GenerateOrAssignContentTypeResult = await testEnv.run(
            generateOrAssignContentType,
            payload({ allowNewContentTypes: false }),
        );

        expect(executeInteractionFromActivity).toHaveBeenCalledWith(
            expect.anything(),
            'sys:SelectDocumentType',
            expect.objectContaining({ allowNewContentTypes: false }),
            expect.objectContaining({
                existing_types: [
                    expect.objectContaining({ name: 'Invoice' }),
                    expect.objectContaining({ name: 'GenericDocument' }),
                ],
            }),
        );
        expect(update).toHaveBeenCalledWith('object-1', { type: 'sys:GenericDocument' }, { suppressWorkflows: true });
        expect(result).toEqual({
            id: 'sys:GenericDocument',
            isNew: false,
            name: 'GenericDocument',
        });
    });

    it('uses a PDF rendition as visual evidence for PowerPoint type selection', async () => {
        const pdfRendition = {
            name: PDF_RENDITION_NAME,
            content: {
                name: 'slides.pdf',
                source: 'renditions/source-etag/slides.pdf',
                type: 'application/pdf',
            },
        };
        const { update } = await mockSetup(
            [typeItem('MarketPresentation', 'active'), typeItem('GenericDocument', 'active')],
            {
                contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                renditions: [pdfRendition],
                text: '',
            },
        );
        mockSelectionResult('MarketPresentation');

        const result: GenerateOrAssignContentTypeResult = await testEnv.run(
            generateOrAssignContentType,
            payload({ allowNewContentTypes: false }),
        );

        expect(executeInteractionFromActivity).toHaveBeenCalledWith(
            expect.anything(),
            'sys:SelectDocumentType',
            expect.objectContaining({ allowNewContentTypes: false }),
            expect.objectContaining({
                content: undefined,
                image: pdfRendition.content,
            }),
        );
        expect(update).toHaveBeenCalledWith(
            'object-1',
            { type: 'type-MarketPresentation' },
            { suppressWorkflows: true },
        );
        expect(result).toEqual({
            id: 'type-MarketPresentation',
            isNew: false,
            name: 'MarketPresentation',
        });
    });

    describe('selection failure log level', () => {
        type TestLogger = NonNullable<NonNullable<ConstructorParameters<typeof MockActivityEnvironment>[1]>['logger']>;

        function capturingEnv(attempt: number) {
            const logger = {
                log: vi.fn(),
                trace: vi.fn(),
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            };
            const env = new MockActivityEnvironment(
                { attempt, retryPolicy: { maximumAttempts: 15 } },
                { logger: logger as unknown as TestLogger },
            );
            return { env, logger };
        }

        function loggedWith(fn: ReturnType<typeof vi.fn>, message: string): boolean {
            return fn.mock.calls.some((call) => call[0] === message);
        }

        it('logs a failure at warn while Temporal will retry the activity', async () => {
            await mockSetup([typeItem('Invoice', 'active')]);
            const failure = new Error('503 - Error executing interaction sys:SelectDocumentType');
            vi.mocked(executeInteractionFromActivity).mockRejectedValue(failure);
            const { env, logger } = capturingEnv(2);

            await expect(env.run(generateOrAssignContentType, payload({ allowNewContentTypes: false }))).rejects.toBe(
                failure,
            );

            expect(loggedWith(logger.warn, 'Failed to select document type')).toBe(true);
            expect(loggedWith(logger.error, 'Failed to select document type')).toBe(false);
        });

        it('logs the last attempt of a server failure at error', async () => {
            await mockSetup([typeItem('Invoice', 'active')]);
            vi.mocked(executeInteractionFromActivity).mockRejectedValue(
                Object.assign(new Error('500 - execution failed'), { status: 500 }),
            );
            const { env, logger } = capturingEnv(15);

            await expect(
                env.run(generateOrAssignContentType, payload({ allowNewContentTypes: false })),
            ).rejects.toThrow('500 - execution failed');

            expect(loggedWith(logger.error, 'Failed to select document type')).toBe(true);
            expect(loggedWith(logger.warn, 'Failed to select document type')).toBe(false);
        });

        it.each([502, 503, 504])('logs an execution API %s at warn even on the last attempt', async (status) => {
            await mockSetup([typeItem('Invoice', 'active')]);
            vi.mocked(executeInteractionFromActivity).mockRejectedValue(
                Object.assign(new Error(`${status} - provider unavailable`), { status }),
            );
            const { env, logger } = capturingEnv(15);

            await expect(
                env.run(generateOrAssignContentType, payload({ allowNewContentTypes: false })),
            ).rejects.toThrow('provider unavailable');

            expect(loggedWith(logger.warn, 'Failed to select document type')).toBe(true);
            expect(loggedWith(logger.error, 'Failed to select document type')).toBe(false);
        });

        it('logs a non-retryable failure at error on an early attempt', async () => {
            await mockSetup([typeItem('Invoice', 'active')]);
            vi.mocked(executeInteractionFromActivity).mockRejectedValue(
                ApplicationFailure.nonRetryable('interaction not found'),
            );
            const { env, logger } = capturingEnv(1);

            await expect(
                env.run(generateOrAssignContentType, payload({ allowNewContentTypes: false })),
            ).rejects.toThrow('interaction not found');

            expect(loggedWith(logger.error, 'Failed to select document type')).toBe(true);
        });
    });
});
