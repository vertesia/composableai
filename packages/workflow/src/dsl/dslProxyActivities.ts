import { ActivityOptions, proxyActivities } from "@temporalio/workflow";
import { DSLActivityExecutionPayload, WorkflowExecutionPayload } from "@vertesia/common";

export interface DslActivityFunction<ParamsT extends Record<string, any> = any, ReturnT = any> {
    (payload: DSLActivityExecutionPayload<ParamsT>): Promise<ReturnT>;
}

export interface DslSimplifiedActivityFunction<ParamsT = any, ReturnT = any> {
    (payload: WorkflowExecutionPayload, params: ParamsT): Promise<ReturnT>;
}

export function dslProxyActivities<
    ActivitiesT extends Record<string, DslActivityFunction<any, any>>
>(workflowName: string, options: ActivityOptions = {}) {
    type DslActivities = {
        [K in keyof ActivitiesT]: ActivitiesT[K] extends DslActivityFunction<infer ParamsT, infer ReturnT>
        ? DslSimplifiedActivityFunction<ParamsT, ReturnT>
        : never;
    };

    const activities = proxyActivities<ActivitiesT>(options) as ActivitiesT;

    return new Proxy({}, {
        get(_target, prop) {
            const activityFn = activities[prop as keyof ActivitiesT] as DslActivityFunction;
            return (payload: WorkflowExecutionPayload, params: any) => {
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
    }) as unknown as DslActivities;
}
