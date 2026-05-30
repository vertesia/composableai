import {
    AbstractFetchClient,
    type FETCH_FN,
    type IRequestRetryPolicy,
    type RequestError,
} from '@vertesia/api-fetch-client';
import type { BulkOperationPayload, BulkOperationResponse } from '@vertesia/common';
import { AgentsApi } from './AgentsApi.js';
import { CollectionsApi } from './CollectionsApi.js';
import { CostApi } from './CostApi.js';
import { DataApi } from './DataApi.js';
import { EmailApi } from './EmailApi.js';
import { IndexingApi } from './IndexingApi.js';
import { EmbeddingsApi } from './EmbeddingsApi.js';
import { ZenoClientNotFoundError } from './errors.js';
import { FilesApi } from './FilesApi.js';
import { HiveMemoryApi } from './HiveMemoryApi.js';
import { ObjectsApi } from './ObjectsApi.js';
import { PendingAsksApi } from './PendingAsksApi.js';
import { ProcessApi } from './ProcessApi.js';
import { QueryApi } from './QueryApi.js';
import { RenderingApi } from './RenderingApi.js';
import { SchedulesApi } from './SchedulesApi.js';
import { TaskApi } from './TaskApi.js';
import { ToolsApi } from './ToolsApi.js';
import { TypesApi } from './TypesApi.js';
import { VERSION, VERSION_HEADER } from './version.js';
import { WorkflowsApi } from './WorkflowsApi.js';

export interface ZenoClientProps {
    serverUrl?: string;
    tokenServerUrl?: string;
    apikey?: string;
    onRequest?: (request: Request) => void;
    onResponse?: (response: Response) => void;
    retryPolicy?: IRequestRetryPolicy;
    fetch?: FETCH_FN | Promise<FETCH_FN>;
}

function ensureDefined(serverUrl: string | undefined) {
    if (!serverUrl) {
        throw new Error('zeno client serverUrl is required');
    }
    return serverUrl;
}

export class ZenoClient extends AbstractFetchClient<ZenoClient> {
    constructor(opts: ZenoClientProps = {}) {
        super(ensureDefined(opts.serverUrl), opts.fetch);
        if (opts.apikey) {
            this.withApiKey(opts.apikey);
        }
        if (opts.retryPolicy) {
            this.withRetryPolicy(opts.retryPolicy);
        }
        this.onRequest = opts.onRequest;
        this.onResponse = opts.onResponse;
        this.errorFactory = (err: RequestError) => {
            if (err.status === 404) {
                return new ZenoClientNotFoundError(err.request, err);
            } else {
                return err;
            }
        };
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
        return this.withAuthCallback(apiKey ? () => Promise.resolve(`Bearer ${apiKey}`) : undefined);
    }

    runOperation(payload: BulkOperationPayload): Promise<BulkOperationResponse> {
        return this.post('/api/v1/operations', {
            payload,
        });
    }

    get initialHeaders() {
        return {
            ...super.initialHeaders,
            [VERSION_HEADER]: VERSION,
        };
    }

    agents = new AgentsApi(this);
    cost = new CostApi(this);
    objects = new ObjectsApi(this);
    types = new TypesApi(this);
    workflows = new WorkflowsApi(this);
    schedules = new SchedulesApi(this);
    processes = new ProcessApi(this);
    tasks = new TaskApi(this);
    files = new FilesApi(this);
    collections = new CollectionsApi(this);
    embeddings = new EmbeddingsApi(this);
    email = new EmailApi(this);
    pendingAsks = new PendingAsksApi(this);
    data = new DataApi(this);
    tools = new ToolsApi(this);
    indexing = new IndexingApi(this);
    query = new QueryApi(this);
    hiveMemory = new HiveMemoryApi(this);
    rendering = new RenderingApi(this);
}
