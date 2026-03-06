import * as protos from '@temporalio/proto';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, bundleWorkflowCode, type WorkflowBundleWithSourceMap } from '@temporalio/worker';
import { ContentEventName, DSLActivityExecutionPayload, DSLActivitySpec, DSLWorkflowExecutionPayload } from '@vertesia/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dslWorkflow } from './dsl-workflow.js';
import { setupActivity } from "./setup/ActivityContext.js";

async function sayHello(payload: DSLActivityExecutionPayload<Record<string, any>>): Promise<string> {
    const { params } = await setupActivity(payload);
    return params.lang === 'fr' ? "Bonjour" : "Hello";
}

async function sayName(payload: DSLActivityExecutionPayload<Record<string, any>>): Promise<string> {
    const { params } = await setupActivity(payload);
    return params.lang === 'fr' ? "Monde" : "World";
}

async function sayGreeting(payload: DSLActivityExecutionPayload<Record<string, any>>): Promise<string> {
    const { params } = await setupActivity(payload);
    return `${params.hello}, ${params.name}!`;
}


const activities: DSLActivitySpec[] = [
    {
        name: 'sayHello',
        output: 'hello',
        import: ["lang"],
    },
    {
        name: 'sayName',
        output: 'name',
        import: ["lang"],
    },
    {
        name: 'sayGreeting',
        import: ["hello", "name"],
        condition: {
            hello: { $null: false },
            name: { $null: false }
        },
        output: 'result',
    },
]

// ========== test env setup ==========


describe('DSL Workflow', () => {

    let testEnv: TestWorkflowEnvironment;
    let workflowBundle: WorkflowBundleWithSourceMap;

    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createLocal();
        const { connection } = testEnv;
        await connection.operatorService.addSearchAttributes({
            namespace: 'default',
            searchAttributes: {
                AccountId: protos.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD,
                DocumentId: protos.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD,
                ProjectId: protos.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD,
                TenantId: protos.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD,
                InitiatedBy: protos.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD,
            },
        });
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

        const lang = 'fr';

        const worker = await Worker.create({
            connection: nativeConnection,
            taskQueue,
            workflowBundle,
            activities: { sayHello, sayName, sayGreeting },
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

        expect(result).toBe('Bonjour, Monde!');

    });





});
