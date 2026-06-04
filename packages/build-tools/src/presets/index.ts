/**
 * Preset transformers for common use cases
 */

export {
    type PromptContentType,
    type PromptDefinition,
    PromptDefinitionSchema,
    PromptRole,
    promptTransformer,
    TemplateType,
} from './prompt.js';
export { rawTransformer } from './raw.js';
export {
    type SkillContentType,
    type SkillDefinition,
    SkillDefinitionSchema,
    SkillPropertiesSchema,
    skillTransformer,
} from './skill.js';
export { skillCollectionTransformer } from './skill-collection.js';
export {
    type RenderingTemplateDefinition,
    RenderingTemplateDefinitionSchema,
    templateTransformer,
} from './template.js';
export { templateCollectionTransformer } from './template-collection.js';
