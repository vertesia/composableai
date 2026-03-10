import { RemoteActivityDefinition, RemoteActivityExecutionPayload, RemoteActivityExecutionResponse } from "@vertesia/common";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { authorize } from "./auth.js";
import { CollectionProperties, ICollection, ToolExecutionContext } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

/**
 * Context provided to activity handlers during execution.
 * Same interface as ToolExecutionContext: includes token, decoded payload, and getClient().
 */
export type ActivityExecutionContext = ToolExecutionContext;

/**
 * Function signature for a remote activity handler.
 */
export type ActivityFn<ParamsT extends Record<string, any> = Record<string, any>> = (
    payload: RemoteActivityExecutionPayload<ParamsT>,
    context: ActivityExecutionContext
) => Promise<any>;

/**
 * An activity definition within an ActivityCollection.
 */
export interface ActivityDefinition<ParamsT extends Record<string, any> = Record<string, any>> {
    /** Activity name (snake_case) */
    name: string;
    /** Display title */
    title?: string;
    /** Description of what the activity does */
    description?: string;
    /** JSON Schema for the activity input parameters */
    input_schema?: Record<string, any>;
    /** JSON Schema for the activity output */
    output_schema?: Record<string, any>;
    /** The activity handler function */
    run: ActivityFn<ParamsT>;
}

export interface ActivityCollectionProperties extends CollectionProperties {
    activities: ActivityDefinition[];
}

/**
 * A collection of remote activities exposed by a tool server for DSL workflows.
 * Follows the same collection pattern as ToolCollection and SkillCollection.
 */
export class ActivityCollection implements ICollection<ActivityDefinition> {
    name: string;
    title?: string;
    icon?: string;
    description?: string;
    private registry: Record<string, ActivityDefinition> = {};

    constructor({ name, title, icon, description, activities }: ActivityCollectionProperties) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        for (const activity of activities) {
            this.registry[activity.name] = activity;
        }
    }

    [Symbol.iterator](): Iterator<ActivityDefinition> {
        let index = 0;
        const activities = Object.values(this.registry);
        return {
            next(): IteratorResult<ActivityDefinition> {
                if (index < activities.length) {
                    return { value: activities[index++], done: false };
                }
                return { done: true, value: undefined };
            }
        };
    }

    /**
     * Get activity definitions for discovery (metadata only, no run function).
     */
    getActivityDefinitions(): RemoteActivityDefinition[] {
        return Object.values(this.registry).map(activity => ({
            name: activity.name,
            title: activity.title,
            description: activity.description,
            input_schema: activity.input_schema,
            output_schema: activity.output_schema,
        }));
    }

    getActivity(name: string): ActivityDefinition {
        const activity = this.registry[name];
        if (!activity) {
            throw new HTTPException(404, {
                message: `Activity not found: ${name}. Available: ${Object.keys(this.registry).join(', ')}`
            });
        }
        return activity;
    }

    /**
     * Execute an activity from an HTTP POST request.
     */
    async execute(ctx: Context, payload: RemoteActivityExecutionPayload): Promise<Response> {
        const activityName = payload.activity_name;

        console.log(`[ActivityCollection] Activity call received: ${activityName}`, {
            collection: this.name,
            metadata: payload.metadata,
            auth_header: ctx.req.header('Authorization')?.slice(0, 30) + '...',
        });

        const activity = this.getActivity(activityName);

        const context = await authorize(ctx, payload.metadata?.endpoints);

        try {
            const result = await activity.run(payload, context);
            return ctx.json({
                result,
                is_error: false,
            } satisfies RemoteActivityExecutionResponse);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[ActivityCollection] Activity execution failed: ${activityName}`, {
                collection: this.name,
                error: message,
            });
            return ctx.json({
                result: null,
                is_error: true,
                error: message,
            } satisfies RemoteActivityExecutionResponse, 500);
        }
    }
}
