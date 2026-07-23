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
                },
            } as unknown as VertesiaClient,
            fetchProject: vi.fn(() => Promise.resolve({ configuration: {} })),
            objectId: 'object-1',
            params: activityPayload.params,
        } as unknown as ActivityContext<GenerateOrAssignContentTypeParams>),
    );

    return { listTypes, update };
}

describe('generateOrAssignContentType', () => {
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
});
