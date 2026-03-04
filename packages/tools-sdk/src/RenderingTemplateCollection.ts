import { CollectionProperties, ICollection, RenderingTemplateDefinition } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

export interface RenderingTemplateCollectionProps extends CollectionProperties {
    templates: RenderingTemplateDefinition[];
}

export class RenderingTemplateCollection implements ICollection<RenderingTemplateDefinition> {
    templates: RenderingTemplateDefinition[];
    name: string;
    title?: string;
    icon?: string;
    description?: string;

    constructor({
        name, title, icon, description, templates
    }: RenderingTemplateCollectionProps) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        this.templates = templates;
    }

    getTemplateDefinitions() {
        return this.templates;
    }

    getTemplate(name: string): RenderingTemplateDefinition | undefined {
        return this.templates.find(t => t.name === name);
    }

    [Symbol.iterator](): Iterator<RenderingTemplateDefinition> {
        let index = 0;
        const templates = this.templates;

        return {
            next(): IteratorResult<RenderingTemplateDefinition> {
                if (index < templates.length) {
                    return { value: templates[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            }
        };
    }

    map<U>(callback: (template: RenderingTemplateDefinition, index: number) => U): U[] {
        return this.templates.map(callback);
    }
}
