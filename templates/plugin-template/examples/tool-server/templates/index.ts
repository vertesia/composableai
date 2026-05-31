import { RenderingTemplateCollection } from '@vertesia/tools-sdk';
import templateDefs from './all?templates';

export const ExampleTemplates = new RenderingTemplateCollection({
    name: 'examples',
    title: 'Example Templates',
    description: 'Example templates demonstrating document and presentation generation',
    templates: templateDefs,
});

// config.ts imports `templates` from here; minimal scaffold exports `[]`.
export const templates = [ExampleTemplates];
