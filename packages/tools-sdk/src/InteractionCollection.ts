import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { InteractionSpec } from "@vertesia/common";
import { ICollection, CollectionProperties } from "./types.js";
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
    addInteraction(interaction: any) {
        this.interactions.push(interaction);
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

/**
 * Load all interactions from a directory.
 * Scans for subdirectories containing index.ts/index.js files.
 *
 * Directory structure:
 * ```
 * interactions/
 *   nagare/
 *     extract-fund-actuals/
 *       index.ts       # exports default InteractionSpec
 *       prompt.jst     # prompt template (read via readPromptFile helper)
 *     parse-fund-document/
 *       index.ts
 *       prompt.md
 * ```
 *
 * @param interactionsDir - Path to the interactions collection directory
 * @returns Promise resolving to array of InteractionSpec objects
 */
export async function loadInteractionsFromDirectory(interactionsDir: string): Promise<InteractionSpec[]> {
    const interactions: InteractionSpec[] = [];

    if (!existsSync(interactionsDir)) {
        console.warn(`Interactions directory not found: ${interactionsDir}`);
        return interactions;
    }

    let entries: string[];
    try {
        entries = readdirSync(interactionsDir);
    } catch {
        console.warn(`Could not read interactions directory: ${interactionsDir}`);
        return interactions;
    }

    for (const entry of entries) {
        // Skip hidden files and index files
        if (entry.startsWith('.')) continue;
        if (entry === 'index.ts' || entry === 'index.js') continue;

        const entryPath = join(interactionsDir, entry);

        try {
            const stat = statSync(entryPath);
            if (!stat.isDirectory()) continue;

            // Look for index.ts or index.js in the subdirectory
            const indexTs = join(entryPath, 'index.ts');
            const indexJs = join(entryPath, 'index.js');
            const indexPath = existsSync(indexTs) ? indexTs : existsSync(indexJs) ? indexJs : null;

            if (!indexPath) {
                continue; // No index file, skip
            }

            // Dynamic import
            const fileUrl = pathToFileURL(indexPath).href;
            const module = await import(fileUrl);

            const interaction = module.default || module.interaction;

            if (interaction && typeof interaction.name === 'string') {
                interactions.push(interaction);
            } else {
                console.warn(`No valid InteractionSpec export found in ${entry}/index`);
            }
        } catch (err) {
            console.warn(`Error loading interaction from ${entry}:`, err);
        }
    }

    return interactions;
}

/**
 * Helper to read a prompt file from the same directory as the interaction.
 * Use this in interaction index.ts files to load prompt templates.
 *
 * @param dirname - Pass __dirname or dirname(fileURLToPath(import.meta.url))
 * @param filename - Prompt filename (e.g., 'prompt.jst' or 'prompt.md')
 * @returns File contents as string
 */
export function readPromptFile(dirname: string, filename: string): string {
    const filePath = join(dirname, filename);
    return readFileSync(filePath, 'utf-8');
}
