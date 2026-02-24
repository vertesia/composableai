import { TemplateCollection } from "@vertesia/tools-sdk";
import templates from './all?templates';

export const ExampleTemplates = new TemplateCollection({
    name: "examples",
    title: "Example Templates",
    description: "Example templates demonstrating document and presentation generation",
    templates
});
