// The template runtime's registry, re-exported so consumers validating or documenting prompts
// read the same names the renderer uses.
export {
    describeTemplateSystemVariables,
    HANDLEBARS_HELPER_NAMES,
    isTemplateSystemVariable,
    TEMPLATE_SYSTEM_VARIABLE_NAMES,
    TEMPLATE_SYSTEM_VARIABLES,
    type TemplateSystemContext,
    type TemplateSystemVariable,
    type TemplateSystemVariableName,
    withTemplateSystemVariables,
} from '@vertesia/jst';
export { substituteEndpoints } from './apps/index.js';
export {
    analyzeHandlebarsTemplate,
    extractHandlebarsVariables,
    type HandlebarsHelperMisuse,
    type HandlebarsTemplateAnalysis,
    type HandlebarsVariableReference,
} from './prompts/extract-vars.js';
export { generateMockData } from './prompts/mock-data.js';
export {
    executeHandlebars,
    executeJST,
    renderPrompt,
    renderSegments,
    renderSegmentsOrErrors,
    renderTemplate,
    type SegmentPreview,
} from './prompts/render.js';
export {
    type PromptValidationInput,
    type PromptValidationIssue,
    type PromptValidationIssueSeverity,
    type PromptValidationIssueType,
    type PromptValidationResult,
    validatePrompt,
} from './prompts/validate.js';
export * from './roles/index.js';
