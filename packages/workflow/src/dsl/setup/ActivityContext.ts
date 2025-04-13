import { log, activityInfo } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import {
    DSLActivityExecutionPayload,
    DSLWorkflowExecutionPayload,
    Project,
    WorkflowExecutionPayload,
} from "@vertesia/common";
import { NoDocumentFound, WorkflowParamNotFound } from "../../errors.js";
import { getProjectFromToken } from "../../utils/auth.js";
import { getVertesiaClient } from "../../utils/client.js";
import { Vars } from "../vars.js";
import { getFetchProvider, registerFetchProviderFactory } from "./fetch/index.js";
import { DocumentProvider, DocumentTypeProvider, InteractionRunProvider } from "./fetch/providers.js";

registerFetchProviderFactory(DocumentProvider.ID, DocumentProvider.factory);
registerFetchProviderFactory(DocumentTypeProvider.ID, DocumentTypeProvider.factory);
registerFetchProviderFactory(InteractionRunProvider.ID, InteractionRunProvider.factory);

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
            throw new WorkflowParamNotFound(
                "objectIds[0]",
                (this.payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload).workflow,
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
            throw new WorkflowParamNotFound(
                "runId",
                (this.payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload).workflow,
            );
        }
        return runId;
    }

    get workflowId() {
        const workflowId = activityInfo().workflowExecution.workflowId;
        if (!workflowId) {
            log.error("No workflowId found in activityInfo");
            throw new WorkflowParamNotFound(
                "workflowId",
                (this.payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload).workflow,
            );
        }
        return workflowId;
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

    const client = getVertesiaClient(payload);
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

                log.info(`Fetching data for ${key} with provider ${provider.name}`, { fetchSpec });
                const result = await provider.fetch(fetchSpec);
                if (result && result.length > 0) {
                    if (fetchSpec.limit === 1) {
                        vars.setValue(key, result[0]);
                    } else {
                        vars.setValue(key, result);
                    }
                } else if (fetchSpec.on_not_found === "throw") {
                    throw new NoDocumentFound("No documents found for: " + JSON.stringify(fetchSpec));
                } else {
                    vars.setValue(key, null);
                }
            }
        }
    }

    const params = vars.resolve() as ParamsT;
    log.info(`Activity ${payload.activity.name} setup complete`);

    return new ActivityContext<ParamsT>(payload, client, params);
}

async function _fetchProject(client: VertesiaClient, payload: WorkflowExecutionPayload) {
    const project = await getProjectFromToken(payload.auth_token);
    return project ? await client.projects.retrieve(project.id) : undefined;
}
