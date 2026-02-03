import { log, activityInfo } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import {
    DSLActivityExecutionPayload,
    DSLWorkflowExecutionPayload,
    Project,
    WorkflowExecutionPayload,
    WorkflowInputType,
} from "@vertesia/common";
import {
    DocumentNotFoundError,
    WorkflowParamNotFoundError,
    WorkflowExecutionError,
} from "../../errors.js";
import { getProjectFromToken } from "../../utils/auth.js";
import { getVertesiaClient } from "../../utils/client.js";
import { Vars } from "../vars.js";
import {
    getFetchProvider,
    registerFetchProviderFactory,
} from "./fetch/index.js";
import {
    DocumentProvider,
    DocumentTypeProvider,
    InteractionRunProvider,
} from "./fetch/providers.js";

registerFetchProviderFactory(DocumentProvider.ID, DocumentProvider.factory);
registerFetchProviderFactory(
    DocumentTypeProvider.ID,
    DocumentTypeProvider.factory,
);
registerFetchProviderFactory(
    InteractionRunProvider.ID,
    InteractionRunProvider.factory,
);

export class ActivityContext<ParamsT extends Record<string, any>> {
    client: VertesiaClient;
    _project?: Promise<Project | undefined>;

    constructor(
        public payload: DSLActivityExecutionPayload<ParamsT>,
        client: VertesiaClient,
        public params: ParamsT,
    ) {
        this.client = client;
        this.fetchProject = this.fetchProject.bind(this);
    }

    get objectIds() {
        return this.payload.objectIds;
    }

    get objectId() {
        const objectId = this.payload.objectIds && this.payload.objectIds[0];
        if (!objectId) {
            log.error("No objectId found in payload");
            throw new WorkflowParamNotFoundError(
                "objectIds[0]",
                (
                    this
                        .payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload
                ).workflow,
            );
        }
        return objectId;
    }

    get activityInfo() {
        return activityInfo();
    }

    get runId() {
        const runId = activityInfo().workflowExecution.runId;
        if (!runId) {
            log.error("No runId found in activityInfo");
            throw new WorkflowParamNotFoundError(
                "runId",
                (
                    this
                        .payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload
                ).workflow,
            );
        }
        return runId;
    }

    get workflowId() {
        const workflowId = activityInfo().workflowExecution.workflowId;
        if (!workflowId) {
            log.error("No workflowId found in activityInfo");
            throw new WorkflowParamNotFoundError(
                "workflowId",
                (
                    this
                        .payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload
                ).workflow,
            );
        }
        return workflowId;
    }

    /**
     * Get the workflow input type (objectIds or files).
     * Defaults to 'objectIds' for backward compatibility with legacy format.
     */
    get inputType(): WorkflowInputType {
        return this.payload.input?.inputType || 'objectIds';
    }

    /**
     * Get the first file URI from the workflow input.
     * Only available when workflow input type is 'files'.
     * @throws {WorkflowExecutionError} If input type is not 'files'
     * @throws {WorkflowParamNotFoundError} If files array is empty
     */
    get file(): string {
        const input = this.payload.input;
        if (!input || input.inputType !== 'files') {
            throw new WorkflowExecutionError(
                'Activity expects files but received objectIds'
            );
        }
        // TypeScript now knows input is { inputType: 'files', files: string[] }
        const files = input.files;
        if (!files || files.length === 0) {
            log.error("No files found in payload");
            throw new WorkflowParamNotFoundError(
                "files[0]",
                (
                    this
                        .payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload
                ).workflow,
            );
        }
        return files[0];
    }

    /**
     * Get all file URIs from the workflow input.
     * Only available when workflow input type is 'files'.
     * @throws {WorkflowExecutionError} If input type is not 'files'
     */
    get files(): string[] {
        const input = this.payload.input;
        if (!input || input.inputType !== 'files') {
            throw new WorkflowExecutionError(
                'Activity expects files but received objectIds'
            );
        }
        // TypeScript now knows input is { inputType: 'files', files: string[] }
        return input.files;
    }

    /**
     * Generic accessor for the first input (objectId or file).
     * Use this in dual-mode activities that support both input types.
     */
    get input(): string {
        return this.inputType === 'objectIds' ? this.objectId : this.file;
    }

    /**
     * Generic accessor for all inputs (objectIds or files).
     * Use this in dual-mode activities that support both input types.
     */
    get inputs(): string[] {
        return this.inputType === 'objectIds' ? (this.objectIds || []) : this.files;
    }

    fetchProject() {
        if (!this._project) {
            this._project = _fetchProject(this.client, this.payload);
        }
        return this._project;
    }
}

export async function setupActivity<ParamsT extends Record<string, any>>(
    payload: DSLActivityExecutionPayload<ParamsT>,
) {
    const isDebugMode = !!payload.debug_mode;

    const vars = new Vars({
        ...payload.params, // imported params (doesn't contain expressions)
        ...payload.activity.params, // activity params (may contain expressions)
    });

    //}
    if (isDebugMode) {
        log.info(`Setting up activity ${payload.activity.name}`, {
            config: payload.config,
            activity: payload.activity,
            params: payload.params,
            vars,
        });
    }

    const client = await getVertesiaClient(payload);
    const fetchSpecs = payload.activity.fetch;
    if (fetchSpecs) {
        const keys = Object.keys(fetchSpecs);
        if (keys.length > 0) {
            // create a new Vars instance to store the fetched data
            for (const key of keys) {
                let fetchSpec = fetchSpecs[key];
                let query = fetchSpec.query;
                if (query) {
                    query = vars.resolveParams(query);
                    fetchSpec = { ...fetchSpec, query };
                }

                const provider = getFetchProvider(client, fetchSpec);

                log.info(
                    `Fetching data for ${key} with provider ${provider.name}`,
                    { fetchSpec },
                );
                const result = await provider.fetch(fetchSpec);
                if (result && result.length > 0) {
                    if (fetchSpec.limit === 1) {
                        vars.setValue(key, result[0]);
                    } else {
                        vars.setValue(key, result);
                    }
                } else if (fetchSpec.on_not_found === "throw") {
                    throw new DocumentNotFoundError(
                        "No documents found for: " + JSON.stringify(fetchSpec),
                    );
                } else {
                    vars.setValue(key, null);
                }
            }
        }
    }

    const params = vars.resolve() as ParamsT;
    return new ActivityContext<ParamsT>(payload, client, params);
}

async function _fetchProject(
    client: VertesiaClient,
    payload: WorkflowExecutionPayload,
) {
    const project = await getProjectFromToken(payload.auth_token);
    return project ? await client.projects.retrieve(project.id) : undefined;
}
