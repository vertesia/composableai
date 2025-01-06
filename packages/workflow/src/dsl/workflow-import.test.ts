import { ContentEventName, DSLActivityExecutionPayload, DSLActivitySpec, DSLWorkflowExecutionPayload } from '@vertesia/common';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dslWorkflow } from './dsl-workflow.js';
import { setupActivity } from "./setup/ActivityContext.js";


async function testImportedVars(payload: DSLActivityExecutionPayload) {
    const { params } = await setupActivity(payload);
    if (!params.object_name) throw new Error('object_name is required');
    console.log('!!!!!!!!!!@@@@@@@@@@@@@@!!!!!!!!!!!!!!', params.object_name);
    return params.object_name;
}


const activities: DSLActivitySpec[] = [
    {
        name: 'testImportedVars',
        import: ["object_name"],
        output: 'result',
    },
]

// ========== test env setup ==========


describe('DSL Workflow import vars', () => {

    let testEnv: TestWorkflowEnvironment;

    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createLocal();
    });

    afterAll(async () => {
        await testEnv?.teardown();
    });


    it('import vars are part of activity params', async () => {


        const { client, nativeConnection } = testEnv;
        const taskQueue = 'test';

        const object_name = 'object_name';

        const worker = await Worker.create({
            connection: nativeConnection,
            taskQueue,
            workflowsPath: new URL("./dsl-workflow.ts", import.meta.url).pathname,
            activities: { testImportedVars },
        });

        const payload: DSLWorkflowExecutionPayload = {
            event: ContentEventName.create,
            objectIds: ['123'],
            vars: {},
            account_id: '123',
            project_id: '123',
            timestamp: Date.now(),
            wf_rule_name: 'test',
            auth_token: 'test',
            config: {
                studio_url: process.env.CP_STUDIO_URL || "http://localhost:8081",
                store_url: process.env.CP_STODRE_URL || "http://localhost:8082",
            },
            workflow: {
                activities,
                vars: {
                    object_name,
                },
                name: 'test',
            }
        }

        let result = await worker.runUntil(client.workflow.execute(dslWorkflow, {
            args: [payload],
            workflowId: 'test',
            taskQueue,
        }));

        expect(result).toBe(object_name);

    });


});
