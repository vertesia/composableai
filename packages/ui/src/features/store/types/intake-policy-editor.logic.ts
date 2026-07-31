import type { ContentTypeIntakePolicy, InteractionExecutionConfiguration } from '@vertesia/common';

export type IntakePolicyPath = readonly string[];

export function updateIntakePolicy(
    policy: ContentTypeIntakePolicy,
    path: IntakePolicyPath,
    value: unknown,
): ContentTypeIntakePolicy {
    if (path.length === 0) {
        return policy;
    }

    const next = structuredClone(policy) as Record<string, unknown>;
    const parents: Record<string, unknown>[] = [next];
    let target = next;

    for (const key of path.slice(0, -1)) {
        const existing = target[key];
        const child = isRecord(existing) ? existing : {};
        target[key] = child;
        target = child;
        parents.push(target);
    }

    const leaf = path[path.length - 1];
    if (value === undefined || value === '') {
        delete target[leaf];
        pruneEmptyParents(parents, path);
    } else {
        target[leaf] = value;
    }

    return next as ContentTypeIntakePolicy;
}

/**
 * `number[][]` in, `[number, number][]` out.
 *
 * The policy type says `number[][]` — JSON has no tuples, and the published component has always
 * described a two-element array rather than a pair — so the editor takes what the policy holds and
 * returns the pair shape the form rows render. The `[1, 1]` default is what makes the result honest:
 * a short row read out of a stored policy is completed rather than assumed.
 */
export function replaceIntakeRange(
    ranges: number[][] | undefined,
    index: number,
    endpoint: 0 | 1,
    value: number,
): [number, number][] {
    const next: [number, number][] = ranges?.map((range) => [range[0] ?? 1, range[1] ?? 1]) ?? [];
    const current = next[index] ?? [1, 1];
    current[endpoint] = value;
    next[index] = current;
    return next;
}

export function updateExecutionEnvironment(
    config: InteractionExecutionConfiguration | undefined,
    environment: string | undefined,
): InteractionExecutionConfiguration | undefined {
    const next = { ...config, environment };
    delete next.model;
    delete next.model_options;
    return hasConfiguration(next) ? next : undefined;
}

export function updateExecutionModel(
    config: InteractionExecutionConfiguration | undefined,
    model: string | undefined,
): InteractionExecutionConfiguration | undefined {
    const next = { ...config, model };
    if (model !== config?.model) {
        delete next.model_options;
    }
    return hasConfiguration(next) ? next : undefined;
}

function pruneEmptyParents(parents: Record<string, unknown>[], path: IntakePolicyPath) {
    for (let index = parents.length - 1; index > 0; index -= 1) {
        const child = parents[index];
        if (Object.keys(child).length > 0) {
            break;
        }
        delete parents[index - 1][path[index - 1]];
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasConfiguration(config: InteractionExecutionConfiguration) {
    return Object.values(config).some((value) => value !== undefined);
}
