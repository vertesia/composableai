import { JSONSchema4 } from "json-schema";
import { ConversationVisibility, InteractionRef } from "../interaction.js";

export enum ContentEventName {
    create = "create",
    change_type = "change_type",
    update = "update",
    revision_created = "revision_created",
    delete = "delete",
    workflow_finished = "workflow_finished",
    workflow_execution_request = "workflow_execution_request",
    api_request = "api_request",
}

export interface Queue {
    name: string;
    // use either suffix or full name. fullname has precedence over suffix
    queue_suffix?: string; // suffix to append to the base queue name
    queue_full_name?: string; // full name
}

export interface WorkflowExecutionBaseParams<T = Record<string, any>> {
    /**
     * The ref of the user who initiated the workflow.
     */
    initiated_by?: string;

    /**
     * The account ID of the user who created the activity.
     * This is useful to select the right database to work on.
     */
    account_id: string;

    /**
     * The project ID of the account who created the activity.
     */
    project_id: string;

    /**
     * The vars field is mainly used to pass the user input to the workflow.
     * The user input ar custom user options that can be used to configure the workflow.
     * You can see the user input as the arguments for a command line app.
     *
     * In the case of workflows started by events (e.g. using a a workflow rule) the user input vars will be initialized with the workflow rule configuration field.
     *
     * In case of dsl workflows the workflow execution payload vars will be applied over the default vars values stored in the DSL vars field.
     */
    vars: T;

    /**
     * Auth Token to access Zeno and Composable from the workers
     */
    auth_token?: string;

    /**
     * The configuration for the workflow execution.
     */
    config?: {
        studio_url: string;
        store_url: string;
        slack_app_url?: string;
        enabled_integrations?: string[]; //list of enabled integrations
    };

    /**
     * The list of endpoints to notify when the workflow finishes.
     * It is handled by a sub-workflow execution, so the main workflow will not wait for the notification to be sent.
     */
    notify_endpoints?: (string | WebHookSpec)[];

    /** If this is a child workflow, parent contains parent's ids  */
    parent?: {
        run_id: string;
        workflow_id: string;
        /**
         * the depth of nested parent workflows
         */
        run_depth?: number;
    };

    /**
     *  List of enabled processing queues. Managed by the application.
     */
    _enabled_queues?: Queue[];

}

export interface WebHookSpec {
    /**
     * The webhook URL to call using POST method
     */
    url: string;
    /**
     * the API version to use if any
     */
    version?: number;
}

export interface WorkflowExecutionPayload<T = Record<string, any>> extends WorkflowExecutionBaseParams<T> {
    /**
     * The event which started the workflow who created the activity.
     */
    event: ContentEventName;

    /*
     * The Workflow Rule ID if any. If the workflow was started by a rule this field will contain the rule ID
     * otherwise if the workflow was started on demand the property will be undefined.
     */
    wf_rule_name?: string;

    /**
     * The ID of the target objects processed by the workflow.
     */
    objectIds: string[];

    /**
     * Auth Token to access Zeno and Composable from the workers
     */
    auth_token: string;
}

export function getDocumentIds(payload: WorkflowExecutionPayload): string[] {
    if ("objectIds" in payload) {
        return payload.objectIds;
    }
    return [];
}

export interface ExecuteWorkflowPayload {
    /**
     * The task queue to assign the workflow to. Deprecated, queues are choosend server side
     */
    //@deprecated
    task_queue?: string;

    /**
     * Docuument IDs pon which the workflow will be executed, deprecated, replaced params in vars
     */
    //@deprecated
    objectIds?: string[];

    /**
     * Parameters to pass to the workflow
     */
    vars?: Record<string, any>;

    /**
     * Make the workflow ID unique by always adding a random token to the ID.
     */
    unique?: boolean;

    /**
     * A custom ID to use for the workflow execution id instead of the generated one.
     */
    custom_id?: string;

    /**
     * Timeout for the workflow execution to complete, in seconds.
     */
    timeout?: number; //timeout in seconds
}

export interface ListWorkflowRunsPayload {
    /**
     * The document ID passed to a workflow run.
     */

    document_id?: string;

    /**
     * The event name that triggered the workflow.
     */
    event_name?: string;

    /**
     * The workflow rule ID that triggered the workflow.
     */
    rule_id?: string;

    /**
     * The start time for filtering workflow runs.
     */
    start?: string;

    /**
     * The end time for filtering workflow runs.
     */
    end?: string;

    /**
     * The status of the workflow run.
     */
    status?: string;

    /**
     * search term to filter on workflow id and run id
     */
    search_term?: string;

    /**
     * The user or service account that initiated the workflow run.
     */
    initiated_by?: string;

    /**
     * The interaction name used to filter conversations.
     */
    interaction?: string;

    /**
     * Lucene query string to search for the workflow runs.
     * This is a full text search on the workflow run history.
     */
    query?: string;

    type?: string;

    /**
     * The maximum number of results to return per page.
     */
    page_size?: number;

    /**
     * The page token for Temporal pagination.
     */
    next_page_token?: string;
}

interface WorkflowRunEvent {
    event_id: number;
    event_time: number;
    event_type: string;
    task_id?: string;
    attempt: number;

    activity?: {
        name?: string;
        id?: string;
        input?: any;
        scheduledEventId?: string;
        startedEventId?: string;
    };

    childWorkflow?: {
        workflowId?: string,
        workflowType?: string,
        runId?: string,
        scheduledEventId?: string,
        startedEventId?: string,
        input?: any,
        result?: any,
    };

    signal?: {
        direction: "receiving" | "sending";
        signalName?: string,
        input?: any,
        sender?: {
            workflowId?: string,
            runId?: string
        }
        recipient?: {
            workflowId?: string,
            runId?: string
        },
        initiatedEventId?: string,
    }

    error?: {
        message?: string;
        source?: string;
        stacktrace?: string;
        type?: string;
    };

    result?: any;
}

export interface WorkflowRun {
    status?: WorkflowExecutionStatus | string;
    /**
     * The Temporal Workflow Type of this Workflow Run.
     *
     * @see https://docs.temporal.io/workflows
     */
    type?: string;
    started_at?: number;
    closed_at?: number;
    execution_duration?: number;
    run_id?: string;
    workflow_id?: string;
    initiated_by?: string;
    interaction_name?: string;
    input?: any;
    result?: any;
    error?: any,
    raw?: any;
    /**
     * The Vertesia Workflow Type of this Workflow Run.
     *  - For DSL workflows (`type:dslWorkflow`), the vertesia_type refers to the "Workflow Rule Name" specified in the
     *    DSL. For example, "Standard Document Intake" or "Standard Image Intake".
     *  - For non-DSL workflows, the vertesia_type is the name of the Temporal Workflow Type.
     */
    vertesia_workflow_type?: string;
    /**
     * An interaction is used to start the agent, the data is stored on temporal "vars"
     */
    interactions?: InteractionRef[];
    /**
     * The visibility of the workflow run.
     * - 'private': Only visible to the user who initiated the workflow
     * - 'project': Visible to all users in the project
     */
    visibility?: ConversationVisibility;
}

export interface WorkflowRunWithDetails extends WorkflowRun {
    history?: WorkflowRunEvent[];
    memo?: {
        [key: string]: any;
    } | null;
    pendingActivities?: {
        activityId?: string;
        activityType?: string;
        attempt: number;
        maximumAttempts: number;
        lastFailure?: string;
        lastStartedTime?: number;
    }[];
}
export interface ListWorkflowRunsResponse {
    runs: WorkflowRun[];
    next_page_token?: string;
    has_more?: boolean;
}

export interface ListWorkflowInteractionsResponse {
    workflow_id: string,
    run_id: string,
    interaction: WorkflowInteraction
}

export interface WorkflowInteraction {
    type: string,
    model: string,
    tools: [],
    interaction: string,
    environment: string,
    data: JSONSchema4,
    interactive: boolean,
    interactionParamsSchema?: JSONSchema4
    debug_mode?: boolean;
    collection_id?: string;
    config: Record<string, any>;
}

export interface MultiDocumentsInteractionParams extends Omit<WorkflowExecutionPayload, "config"> {
    config: {
        interactionName: string;
        action: DocumentActionConfig;
        data: Record<string, any>;
    };
}

export interface DocumentActionConfig {
    contentTypeName?: string; //content type to use
    setAsProperties: boolean; //set result as properties
    setAsText: string; //set result as text, if result set the whole result as text
    setNameFrom: string; //result property to use as name
    upsert: boolean; //wether to upsert or update only
    documentId?: string; //doc Id to update
    parentId?: string; //parentId for the created doc
}

export enum WorkflowExecutionStatus {
    UNKNOWN = 0,
    RUNNING = 1,
    COMPLETED = 2,
    FAILED = 3,
    CANCELED = 4,
    TERMINATED = 5,
    CONTINUED_AS_NEW = 6,
    TIMED_OUT = 7,
}

/**
 * Basic response for anything run with an async workflow
 */
export interface WorkflowRunStatus {
    workflow_id: string | null;
    workflow_run_id: string | null;
    status: WorkflowExecutionStatus;
}

/**
 * Workflow Update Message
 */
export interface AgentMessage {
    timestamp: number;
    workflow_run_id: string;
    type: AgentMessageType;
    message: string;
    details?: any;
    workstream_id?: string;
}

export enum AgentMessageType {
    SYSTEM = "system",
    THOUGHT = "thought",
    PLAN = "plan",
    UPDATE = "update",
    COMPLETE = "complete",
    WARNING = "warning",
    ERROR = "error",
    ANSWER = "answer",
    QUESTION = "question",
    REQUEST_INPUT = "request_input",
    IDLE = "idle",
    TERMINATED = "terminated",
}

export interface PlanTask {
    id: number;
    goal: string;
    instructions: string[];
    comment?: string;
    status?: "pending" | "in_progress" | "completed" | "skipped";
}

export interface Plan {
    plan: PlanTask[];
    comment?: string;
}

export const LOW_PRIORITY_TASK_QUEUE = "low_priority";

/**
 * Payload for applying actions to a workflow run (e.g., cancel, terminate).
 */
export interface WorkflowActionPayload {
    /**
     * Optional reason for the action.
     */
    reason?: string;
}
