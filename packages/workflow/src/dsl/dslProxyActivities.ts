import { type ActivityOptions, proxyActivities } from '@temporalio/workflow';
import type {
    DSLActivityExecutionPayload,
    WorkflowExecutionBaseParams,
    WorkflowExecutionPayload,
} from '@vertesia/common';

export type DslActivityFunction<ParamsT extends object = Record<string, unknown>, ReturnT = unknown> = (
    payload: DSLActivityExecutionPayload<ParamsT>,
) => Promise<ReturnT>;

export type DslSimplifiedActivityFunction<ParamsT extends object = Record<string, unknown>, ReturnT = unknown> = (
    payload: WorkflowExecutionBaseParams<unknown>,
    params: ParamsT,
) => Promise<ReturnT>;

export function stripWorkflowContinuationFromVars<T>(vars: T): T {
    if (!vars || typeof vars !== 'object' || Array.isArray(vars) || !('_continuation' in vars)) {
        return vars;
    }

    const rest = { ...(vars as Record<string, unknown>) };
    delete rest._continuation;
    return rest as T;
}

export interface DslProxyOptions {
    /**
     * Optional filter applied to `payload.vars` before it is copied into each
     * activity input. The DSL spreads the whole workflow payload into every
     * activity scheduling, so for workflows with a large or growing `vars` this
     * lets the caller keep only the fields its activities actually read —
     * multiplying the saving by every activity event in the history.
     *
     * Runs synchronously inside the Temporal workflow sandbox on every activity
     * call: it must be deterministic, must not mutate its input (when `vars`
     * carries no `_continuation` the original workflow object is passed, not a
     * copy), and must return a new plain object. The synchronous return type
     * makes an async implementation a compile error.
     */
    varsFilter?: (vars: Readonly<Record<string, unknown>>) => Record<string, unknown>;
}

export function dslProxyActivities<ActivitiesT extends object>(
    workflowName: string,
    options: ActivityOptions & DslProxyOptions = {},
) {
    type DslActivities = {
        [K in keyof ActivitiesT]: ActivitiesT[K] extends DslActivityFunction<infer ParamsT, infer ReturnT>
            ? DslSimplifiedActivityFunction<ParamsT, ReturnT>
            : never;
    };

    const { varsFilter, ...activityOptions } = options;
    const activities = proxyActivities<ActivitiesT>(activityOptions) as ActivitiesT;

    return new Proxy(
        {},
        {
            get(_target, prop) {
                const activityFn = activities[prop as keyof ActivitiesT] as unknown as DslActivityFunction<
                    Record<string, unknown>,
                    unknown
                >;
                return (payload: WorkflowExecutionPayload, params: Record<string, unknown>) => {
                    const vars = stripWorkflowContinuationFromVars(payload.vars);
                    const filteredVars =
                        varsFilter && vars && typeof vars === 'object' && !Array.isArray(vars)
                            ? (varsFilter(vars as Record<string, unknown>) as typeof vars)
                            : vars;
                    return activityFn({
                        ...payload,
                        vars: filteredVars,
                        activity: {
                            name: prop as string,
                        },
                        workflow_name: workflowName,
                        params,
                    });
                };
            },
        },
    ) as unknown as DslActivities;
}
