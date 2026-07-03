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

export function dslProxyActivities<ActivitiesT extends object>(workflowName: string, options: ActivityOptions = {}) {
    type DslActivities = {
        [K in keyof ActivitiesT]: ActivitiesT[K] extends DslActivityFunction<infer ParamsT, infer ReturnT>
            ? DslSimplifiedActivityFunction<ParamsT, ReturnT>
            : never;
    };

    const activities = proxyActivities<ActivitiesT>(options) as ActivitiesT;

    return new Proxy(
        {},
        {
            get(_target, prop) {
                const activityFn = activities[prop as keyof ActivitiesT] as unknown as DslActivityFunction<
                    Record<string, unknown>,
                    unknown
                >;
                return (payload: WorkflowExecutionPayload, params: Record<string, unknown>) => {
                    return activityFn({
                        ...payload,
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
