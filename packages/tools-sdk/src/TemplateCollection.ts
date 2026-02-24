import { CollectionProperties, ICollection, TemplateDefinition } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

export interface TemplateCollectionProps extends CollectionProperties {
    templates: TemplateDefinition[];
}

export class TemplateCollection implements ICollection<TemplateDefinition> {
    templates: TemplateDefinition[];
    name: string;
    title?: string;
    icon?: string;
    description?: string;

    constructor({
        name, title, icon, description, templates
    }: TemplateCollectionProps) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        this.templates = templates;
    }

    getTemplateDefinitions() {
        return this.templates;
    }

    getTemplate(name: string): TemplateDefinition | undefined {
        return this.templates.find(t => t.name === name);
    }

    [Symbol.iterator](): Iterator<TemplateDefinition> {
        let index = 0;
        const templates = this.templates;

        return {
            next(): IteratorResult<TemplateDefinition> {
                if (index < templates.length) {
                    return { value: templates[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            }
        };
    }

    map<U>(callback: (template: TemplateDefinition, index: number) => U): U[] {
        return this.templates.map(callback);
    }
}
