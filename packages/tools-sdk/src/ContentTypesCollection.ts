import { InCodeTypeDefinition } from "@vertesia/common";
import { CollectionProperties, ICollection } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

export interface ContentTypesCollectionProps extends CollectionProperties {
    types: InCodeTypeDefinition[];
}
export class ContentTypesCollection implements ICollection<InCodeTypeDefinition> {
    types: InCodeTypeDefinition[];
    name: string;
    title?: string;
    icon?: string;
    description?: string;
    constructor({
        name, title, icon, description, types
    }: ContentTypesCollectionProps) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        this.types = types;
    }

    getContentTypes() {
        return this.types;
    }

    [Symbol.iterator](): Iterator<InCodeTypeDefinition> {
        let index = 0;
        const types = this.types;

        return {
            next(): IteratorResult<InCodeTypeDefinition> {
                if (index < types.length) {
                    return { value: types[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            }
        };
    }

    map<U>(callback: (type: InCodeTypeDefinition, index: number) => U): U[] {
        return this.types.map(callback);
    }

    getTypeByName(name: string): InCodeTypeDefinition | undefined {
        return this.types.find(type => type.name === name);
    }

}
