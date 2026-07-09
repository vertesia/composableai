import { RenderingTemplateCollection } from '@vertesia/tools-sdk';
import templateDefinitions from './all?templates';

export const ExampleTemplates = new RenderingTemplateCollection({
    name: 'examples',
    title: 'Example Templates',
    description: 'Example templates demonstrating document and presentation generation',
    templates: templateDefinitions,
});

export const templates = [ExampleTemplates];
