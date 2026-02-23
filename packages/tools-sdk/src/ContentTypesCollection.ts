import { InCodeTypeSpec } from "@vertesia/common";
import { CollectionProperties, ICollection } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

export interface ContentTypesCollectionProps extends CollectionProperties {
    types: InCodeTypeSpec[];
}
export class ContentTypesCollection implements ICollection<InCodeTypeSpec> {
    types: InCodeTypeSpec[];
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

    [Symbol.iterator](): Iterator<InCodeTypeSpec> {
        let index = 0;
        const types = this.types;

        return {
            next(): IteratorResult<InCodeTypeSpec> {
                if (index < types.length) {
                    return { value: types[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            }
        };
    }

    map<U>(callback: (type: InCodeTypeSpec, index: number) => U): U[] {
        return this.types.map(callback);
    }

    getTypeByName(name: string): InCodeTypeSpec | undefined {
        return this.types.find(type => type.name === name);
    }

}
