import { PromptRole } from '@llumiverse/common';
import {
    type PromptSegmentDef,
    PromptSegmentDefType,
    PromptStatus,
    type PromptTemplate,
    TemplateType,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';

import { renderSegments, renderTemplate } from './render.js';

describe('renderTemplate', () => {
    it('returns text content verbatim instead of evaluating it as JST', () => {
        const content = 'You are a test assistant for skill validation. Be concise.';
        expect(renderTemplate(content, TemplateType.text, {}, {})).toEqual(content);
    });

    it('renders handlebars templates', () => {
        expect(renderTemplate('Hello {{name}}', TemplateType.handlebars, {}, { name: 'Ada' })).toEqual('Hello Ada');
    });

    it('renders JST templates', () => {
        expect(
            renderTemplate('return `Hello ${name}`', TemplateType.jst, { properties: { name: {} } }, { name: 'Ada' }),
        ).toEqual('Hello Ada');
    });
});

describe('renderSegments', () => {
    it('renders a text system segment followed by a handlebars user segment', () => {
        const segments: PromptSegmentDef<PromptTemplate>[] = [
            {
                type: PromptSegmentDefType.template,
                template: createPromptTemplate({
                    id: 'sys-1',
                    role: PromptRole.system,
                    content: 'You are a test assistant for skill validation. Be concise.',
                    content_type: TemplateType.text,
                }),
            },
            {
                type: PromptSegmentDefType.template,
                template: createPromptTemplate({
                    id: 'user-1',
                    role: PromptRole.user,
                    content: 'Answer this question: {{question}}',
                    content_type: TemplateType.handlebars,
                }),
            },
        ];

        expect(renderSegments(segments, { question: 'What is 2+2?' })).toEqual([
            {
                title: '@system',
                content: 'You are a test assistant for skill validation. Be concise.',
                segmentId: 'sys-1',
            },
            {
                title: '@user',
                content: 'Answer this question: What is 2+2?',
                segmentId: 'user-1',
            },
        ]);
    });

    it('isolates a failing segment so the remaining segments still render', () => {
        const segments: PromptSegmentDef<PromptTemplate>[] = [
            {
                type: PromptSegmentDefType.template,
                template: createPromptTemplate({
                    id: 'bad-1',
                    content: 'return missingGlobal',
                    content_type: TemplateType.jst,
                }),
            },
            {
                type: PromptSegmentDefType.template,
                template: createPromptTemplate({
                    id: 'good-1',
                    content: 'Hello {{name}}',
                    content_type: TemplateType.handlebars,
                }),
            },
        ];

        const result = renderSegments(segments, { name: 'Ada' });
        expect(result[0].error).toBeInstanceOf(Error);
        expect(result[1]).toEqual({ title: '@user', content: 'Hello Ada', segmentId: 'good-1' });
    });
});

function createPromptTemplate(overrides: Partial<PromptTemplate>): PromptTemplate {
    return {
        id: 'prompt-1',
        name: 'Greeting',
        role: PromptRole.user,
        status: PromptStatus.draft,
        version: 1,
        content: '',
        content_type: TemplateType.jst,
        project: 'project-1',
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
    };
}
