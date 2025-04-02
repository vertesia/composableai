export enum ContentEventName {
    create = "create",
    change_type = "change_type",
    update = "update",
    delete = "delete",
    workflow_finished = "workflow_finished",
    workflow_execution_request = "workflow_execution_request",
    api_request = "api_request",
}

export interface WorkflowExecutionBaseParams<T = Record<string, any>> {
    /**
     * The ref of the user who initiated the workflow.
     */
    initiated_by?: string;

    /**
     * The account ID of the user who created the activity.
     * This is usefull to select the right database to work on.
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
     * In case of dsl workflows the worflow execution payload vars will be applied over the default vars values stored in the DSL vars field.
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
        enabled_integrations?: string[]; //list of enabled integrations
    };

    /**
     * The list of endpoints to notify when the workflow finishes.
     * It is handled by a subworkflow execution, so the main workflow will not wait for the notification to be sent.
     */
    notify_endpoints?: string[];
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

export interface ExecuteWorkflowPayload {
    task_queue?: string;
    objectIds?: string[];
    vars?: Record<string, any>;
    unique?: boolean;
}

export interface ListWorkflowRunsPayload {
    document_id?: string;
    event_name?: string;
    rule_id?: string;
    start?: string;
    end?: string;
    status?: string;
    search_term?: string;
    initiated_by?: string;
}

interface WorkflowRunEvent {
    event_id: number;
    event_time: number;
    event_type: string;
    task_id: string;
    attempt: number;

    activity?: {
        name: string;
        id: string;
        input?: any;
    };

    error?: {
        message: string;
        source: string;
        stacktrace: string;
        type?: string;
    };

    result?: any;
}

export interface WorkflowRun {
    status?: WorkflowExecutionStatus | string;
    type?: string;
    started_at?: number;
    closed_at?: number;
    execution_duration?: number;
    run_id?: string;
    workflow_id?: string;
    initiated_by?: string;
    result?: any;
    raw?: any;
}

export interface WorkflowRunWithDetails extends WorkflowRun {
    history?: WorkflowRunEvent[];
}
export interface ListWorkflowRunsResponse {
    runs: WorkflowRun[];
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
    message?: string;
    details?: any;
}

export enum AgentMessageType {
    INIT = "init",
    SYSTEM = "system",
    THOUGHT = "thought",
    PLAN = "plan",
    UPDATE = "update",
    COMPLETE = "complete",
    WARNING = "warning",
    ERROR = "error",
}
