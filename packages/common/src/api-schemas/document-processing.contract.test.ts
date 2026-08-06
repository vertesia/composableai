import { describe, expect, it } from 'vitest';
import type { DocAnalyzeRunStatusResponse, DocumentPrepOptions } from '../store/doc-analyzer.js';
import type { GroundedExtractionRequest } from '../store/grounded-extraction.js';
import type {
    RenderMarkdownPayload,
    RenderMarkdownStartResponse,
    RenderMarkdownStatusQuery,
} from '../store/rendering.js';
import { MarkdownRenditionFormat } from '../store/store.js';
import { WorkflowExecutionStatus } from '../store/workflow.js';
import type {
    DocAnalyzeRunStatusResponseSchema,
    DocumentPrepOptionsSchema,
    GroundedExtractionRequestSchema,
    RenderMarkdownPayloadSchema,
    RenderMarkdownStartResponseSchema,
    RenderMarkdownStatusQuerySchema,
} from './document-processing.js';
import { validateApiRequest, validateApiResponse } from './registry.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_value: T): void {}

describe('rendering and document-processing API contracts', () => {
    it('derives the public types from their schemas', () => {
        assertType<Equals<RenderMarkdownPayload, typeof RenderMarkdownPayloadSchema._output>>(true);
        assertType<Equals<RenderMarkdownStartResponse, typeof RenderMarkdownStartResponseSchema._output>>(true);
        assertType<Equals<RenderMarkdownStatusQuery, typeof RenderMarkdownStatusQuerySchema._output>>(true);
        assertType<Equals<DocumentPrepOptions, typeof DocumentPrepOptionsSchema._output>>(true);
        assertType<Equals<GroundedExtractionRequest, typeof GroundedExtractionRequestSchema._output>>(true);
        assertType<Equals<DocAnalyzeRunStatusResponse, typeof DocAnalyzeRunStatusResponseSchema._output>>(true);
    });

    it('keeps WorkflowExecutionStatus numeric on the wire', () => {
        expect(
            validateApiResponse('RenderMarkdownStartResponse', {
                workflow_id: 'render:1',
                workflow_run_id: 'run-1',
                status: WorkflowExecutionStatus.RUNNING,
                format: MarkdownRenditionFormat.pdf,
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('RenderMarkdownStartResponse', {
                workflow_id: 'render:1',
                workflow_run_id: 'run-1',
                status: WorkflowExecutionStatus.TIMED_OUT,
                format: MarkdownRenditionFormat.pdf,
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('RenderMarkdownStartResponse', {
                workflow_id: 'render:1',
                workflow_run_id: 'run-1',
                status: 'RUNNING',
                format: MarkdownRenditionFormat.pdf,
            }).valid,
        ).toBe(false);
    });

    it('keeps document prep extensible while closing grounded extraction', () => {
        expect(validateApiRequest('DocumentPrepOptions', { custom_processor_flag: true }).valid).toBe(true);
        expect(validateApiRequest('GroundedExtractionRequest', { force_ocr: true }).valid).toBe(true);
        expect(validateApiRequest('GroundedExtractionRequest', { force_ocr: true, unexpected: true }).valid).toBe(
            false,
        );
    });

    it('enforces the published rendering metadata author array', () => {
        const base = { format: MarkdownRenditionFormat.pdf, content: '# Report' };
        expect(validateApiRequest('RenderMarkdownPayload', { ...base, metadata: { author: ['Ada'] } }).valid).toBe(
            true,
        );
        expect(validateApiRequest('RenderMarkdownPayload', { ...base, metadata: { author: 'Ada' } }).valid).toBe(false);
    });
});
