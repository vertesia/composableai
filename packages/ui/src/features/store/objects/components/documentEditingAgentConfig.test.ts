import { describe, expect, it } from 'vitest';
import {
    DOCUMENT_EDITING_EXCLUDED_TOOLS,
    DOCUMENT_EDITING_INITIAL_SKILLS,
    DOCUMENT_EDITING_TOOLS,
} from './documentEditingAgentConfig.js';

describe('document editing agent configuration', () => {
    it('starts with artifact and code execution guidance and permits shell execution', () => {
        expect(DOCUMENT_EDITING_INITIAL_SKILLS).toEqual(['artifact_operations', 'code_execution']);
        expect(DOCUMENT_EDITING_TOOLS).toContain('execute_shell');
        expect(DOCUMENT_EDITING_EXCLUDED_TOOLS).not.toContain('execute_shell');
    });

    it('offers relevant skills without exposing canonical document writes', () => {
        expect(DOCUMENT_EDITING_TOOLS).toEqual(
            expect.arrayContaining([
                'learn_content_authoring',
                'learn_document_management',
                'learn_document_search',
                'learn_image_analysis',
            ]),
        );
        expect(DOCUMENT_EDITING_EXCLUDED_TOOLS).toEqual(
            expect.arrayContaining(['create_document', 'update_document', 'merge_documents', 'batch_execute']),
        );
    });
});
