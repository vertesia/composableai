/**
 * CLI-friendly name registry for the built-in transformers.
 *
 * Names mirror the query-suffix convention used in source code:
 *   `?skill`   → 'skill'
 *   `?skills`  → 'skills'         (collection)
 *   `?template`→ 'template'
 *   `?templates`→ 'templates'     (collection)
 *   `?prompt`  → 'prompt'
 *   `?raw`     → 'raw'
 */

import { promptTransformer } from '../core/transformers/prompt.js';
import { rawTransformer } from '../core/transformers/raw.js';
import { skillTransformer } from '../core/transformers/skill.js';
import { skillCollectionTransformer } from '../core/transformers/skill-collection.js';
import { templateTransformer } from '../core/transformers/template.js';
import { templateCollectionTransformer } from '../core/transformers/template-collection.js';
import type { TransformerRule } from '../core/types.js';

export const BUILTIN_TRANSFORMERS: Readonly<Record<string, TransformerRule>> = Object.freeze({
    skill: skillTransformer,
    skills: skillCollectionTransformer,
    template: templateTransformer,
    templates: templateCollectionTransformer,
    prompt: promptTransformer,
    raw: rawTransformer,
});

/** Names of all registered transformers, in stable order. */
export const BUILTIN_TRANSFORMER_NAMES: readonly string[] = Object.freeze(Object.keys(BUILTIN_TRANSFORMERS));

/**
 * Resolve a list of transformer names to their concrete `TransformerRule`
 * instances. Throws if any name is unknown.
 */
export function resolveTransformerNames(names: readonly string[]): TransformerRule[] {
    const resolved: TransformerRule[] = [];
    const unknown: string[] = [];

    for (const name of names) {
        const rule = BUILTIN_TRANSFORMERS[name];
        if (rule) {
            resolved.push(rule);
        } else {
            unknown.push(name);
        }
    }

    if (unknown.length > 0) {
        const known = BUILTIN_TRANSFORMER_NAMES.join(', ');
        throw new Error(`Unknown transformer name(s): ${unknown.join(', ')}. Known transformers: ${known}.`);
    }

    return resolved;
}
