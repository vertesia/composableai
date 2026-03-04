import { InteractionSpec } from "@vertesia/common";
import { CollectionProperties, ICollection } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

export interface InteractionCollectionProps extends CollectionProperties {
    interactions: InteractionSpec[];
}
export class InteractionCollection implements ICollection<InteractionSpec> {
    interactions: InteractionSpec[];
    name: string;
    title?: string;
    icon?: string;
    description?: string;
    constructor({
        name, title, icon, description, interactions
    }: InteractionCollectionProps) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        this.interactions = interactions;
    }

    getInteractions() {
        return this.interactions;
    }

    [Symbol.iterator](): Iterator<InteractionSpec> {
        let index = 0;
        const interactions = this.interactions;

        return {
            next(): IteratorResult<InteractionSpec> {
                if (index < interactions.length) {
                    return { value: interactions[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            }
        };
    }

    map<U>(callback: (interaction: InteractionSpec, index: number) => U): U[] {
        return this.interactions.map(callback);
    }

    getInteractionByName(name: string): InteractionSpec | undefined {
        return this.interactions.find(interaction => interaction.name === name);
    }
}
