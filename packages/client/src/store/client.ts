import { AbstractFetchClient, RequestError } from "@vertesia/api-fetch-client";
import { BulkOperationPayload, BulkOperationResult } from "@vertesia/common";
import { AgentsApi } from "./AgentsApi.js";
import { CollectionsApi } from "./CollectionsApi.js";
import { CommandsApi } from "./CommandsApi.js";
import { EmbeddingsApi } from "./EmbeddingsApi.js";
import { ZenoClientNotFoundError } from "./errors.js";
import { FilesApi } from "./FilesApi.js";
import { ObjectsApi } from "./ObjectsApi.js";
import { TypesApi } from "./TypesApi.js";
import { VERSION, VERSION_HEADER } from "./version.js";
import { WorkflowsApi } from "./WorkflowsApi.js";

export interface ZenoClientProps {
    serverUrl?: string;
    apikey?: string;
    onRequest?: (request: Request) => void;
    onResponse?: (response: Response) => void;
}

function ensureDefined(serverUrl: string | undefined) {
    if (!serverUrl) {
        throw new Error("zeno client serverUrl is required");
    }
    return serverUrl;
}

export class ZenoClient extends AbstractFetchClient<ZenoClient> {

    constructor(
        opts: ZenoClientProps = {}
    ) {
        super(ensureDefined(opts.serverUrl));
        if (opts.apikey) {
            this.withApiKey(opts.apikey);
        }
        this.onRequest = opts.onRequest;
        this.onResponse = opts.onResponse;
        this.errorFactory = (err: RequestError) => {
            if (err.status === 404) {
                return new ZenoClientNotFoundError(err.request, err);
            } else {
                return err;
            }
        }
    }

    withApiVersion(version: string | number | null) {
        if (!version) {
            delete this.headers[VERSION_HEADER];
        } else {
            this.headers[VERSION_HEADER] = String(version);
        }
        return this;
    }

    withApiKey(apiKey: string | null) {
        return this.withAuthCallback(
            apiKey ? () => Promise.resolve(`Bearer ${apiKey}`) : undefined
        );
    }

    runOperation(payload: BulkOperationPayload): Promise<BulkOperationResult> {
        return this.post("/api/v1/operations", {
            payload
        });
    }

    get initialHeaders() {
        return {
            ...super.initialHeaders,
            [VERSION_HEADER]: VERSION
        }
    }

    objects = new ObjectsApi(this);
    types = new TypesApi(this);
    workflows = new WorkflowsApi(this);
    files = new FilesApi(this);
    commands = new CommandsApi(this);
    agents = new AgentsApi(this);
    collections = new CollectionsApi(this);
    embeddings = new EmbeddingsApi(this);
}
