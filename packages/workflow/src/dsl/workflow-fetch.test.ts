import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, bundleWorkflowCode, type WorkflowBundleWithSourceMap } from '@temporalio/worker';
import { VertesiaClient } from '@vertesia/client';
import { ContentEventName, DSLActivityExecutionPayload, DSLActivitySpec, DSLWorkflowExecutionPayload, FindPayload } from '@vertesia/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dslWorkflow } from './dsl-workflow.js';
import { setupActivity } from "./setup/ActivityContext.js";
import { DataProvider } from './setup/fetch/DataProvider.js';
import { registerFetchProviderFactory } from './setup/fetch/index.js';

interface SayMessageParams {
    message: string;
}

class DocumentTestProvider extends DataProvider {

    static ID = "document";

    constructor() {
        super(DocumentTestProvider.ID, true);
    }

    doFetch(payload: FindPayload): Promise<Record<string, any>[]> {
        const query = payload.query;
        console.log('query', query);
        if (query.lang === 'en') {
            return Promise.resolve([query.greeting ? { text: 'Hello' } : { text: "World" }])
        } else {
            return Promise.resolve([query.greeting ? { text: 'Bonjour' } : { text: "Monde" }])
        }
    }

    static factory(_context: VertesiaClient) {
        return new DocumentTestProvider();
    }
}

registerFetchProviderFactory(DocumentTestProvider.ID, DocumentTestProvider.factory);


async function sayMessage(payload: DSLActivityExecutionPayload<SayMessageParams>): Promise<string> {
    const { params } = await setupActivity(payload);
    return params.message;
}


const activities: DSLActivitySpec[] = [
    {
        name: 'sayMessage',
        output: 'result',
        import: ["lang"],
        params: {
            message: "${greeting.text}, ${name.text}!"
        },
        fetch: {
            name: {
                type: "document",
                query: {
                    lang: "${lang}", greeting: false
                },
                limit: 1,
            },
            greeting: {
                type: "document",
                query: {
                    lang: "${lang}", greeting: true
                },
                limit: 1,
            }
        },
    },
]

// ========== test env setup ==========


describe('DSL Workflow', () => {

    let testEnv: TestWorkflowEnvironment;
    let workflowBundle: WorkflowBundleWithSourceMap;

    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createLocal();
        workflowBundle = await bundleWorkflowCode({
            workflowsPath: new URL('./dsl-workflow.ts', import.meta.url).pathname,
        });
    }, 60_000);

    afterAll(async () => {
        await testEnv?.teardown();
    });

    it('successfully completes a mock workflow', async () => {
        const { client, nativeConnection } = testEnv;
        const taskQueue = 'test';

        const lang = 'en';

        const worker = await Worker.create({
            connection: nativeConnection,
            taskQueue,
            workflowBundle,
            activities: { sayMessage },
        });

        const payload: DSLWorkflowExecutionPayload = {
            event: ContentEventName.create,
            objectIds: ['123'],
            vars: {},
            account_id: '123',
            project_id: '123',
            wf_rule_name: 'test',
            auth_token: process.env.VERTESIA_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature',
            config: {
                studio_url: process.env.CP_STUDIO_URL || "http://localhost:8081",
                store_url: process.env.CP_STORE_URL || "http://localhost:8082",
            },
            workflow: {
                activities,
                vars: {
                    lang,
                },
                name: 'test',
            }
        }

        const result = await worker.runUntil(client.workflow.execute(dslWorkflow, {
            args: [payload],
            workflowId: 'test',
            taskQueue,
        }));

        expect(result).toBe('Hello, World!');

    });





});
