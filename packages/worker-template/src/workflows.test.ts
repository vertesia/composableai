import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
    ActivityExecutionPayload,
    ObjectMetadata,
    ProcessObjectParams,
    ProcessObjectResult,
} from "./activities.js";
import { getMockWorkflowPayload } from "./test/utils.js";
import {
    exampleWorkflow,
    inspectObjectsWorkflow,
    type ExampleWorkflowResult,
} from "./workflows.js";

describe("Workflows", () => {
    let testEnv: TestWorkflowEnvironment;

    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createLocal();
    });

    afterAll(async () => {
        await testEnv?.teardown();
    });

    describe("exampleWorkflow", () => {
        it("successfully processes multiple objects", async () => {
            const { client, nativeConnection } = testEnv;
            const taskQueue = "test-example-workflow";

            // Mock activity implementations
            const mockResults: Record<string, ProcessObjectResult> = {
                "object-1": { objectId: "object-1", name: "Document 1", success: true },
                "object-2": { objectId: "object-2", name: "Document 2", success: true },
            };

            const activities = {
                processObjectActivity: (
                    payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ProcessObjectResult> =>
                    Promise.resolve(mockResults[payload.params.objectId]),
                getObjectMetadataActivity: (
                    _payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ObjectMetadata> =>
                    Promise.resolve({ objectId: "", name: "", properties: {} }),
            };

            const worker = await Worker.create({
                connection: nativeConnection,
                taskQueue,
                workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
                activities,
            });

            const payload = getMockWorkflowPayload({}, ["object-1", "object-2"]);

            const result: ExampleWorkflowResult = await worker.runUntil(
                client.workflow.execute(exampleWorkflow, {
                    args: [payload],
                    workflowId: "test-example-workflow",
                    taskQueue,
                })
            );

            expect(result.processedObjects).toBe(2);
            expect(result.results).toHaveLength(2);
            expect(result.results[0]).toEqual({
                objectId: "object-1",
                name: "Document 1",
                success: true,
            });
            expect(result.results[1]).toEqual({
                objectId: "object-2",
                name: "Document 2",
                success: true,
            });
        });

        it("handles dry run mode", async () => {
            const { client, nativeConnection } = testEnv;
            const taskQueue = "test-example-workflow-dry-run";

            const activities = {
                processObjectActivity: (
                    _payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ProcessObjectResult> =>
                    Promise.resolve({
                        objectId: "object-1",
                        name: "Document 1",
                        success: true,
                        message: "Dry run - no changes made",
                    }),
                getObjectMetadataActivity: (
                    _payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ObjectMetadata> =>
                    Promise.resolve({ objectId: "", name: "", properties: {} }),
            };

            const worker = await Worker.create({
                connection: nativeConnection,
                taskQueue,
                workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
                activities,
            });

            const payload = getMockWorkflowPayload({ dryRun: true }, ["object-1"]);

            const result: ExampleWorkflowResult = await worker.runUntil(
                client.workflow.execute(exampleWorkflow, {
                    args: [payload],
                    workflowId: "test-example-workflow-dry-run",
                    taskQueue,
                })
            );

            expect(result.processedObjects).toBe(1);
            expect(result.results[0]).toEqual({
                objectId: "object-1",
                name: "Document 1",
                success: true,
                message: "Dry run - no changes made",
            });
        });

        it("handles empty objectIds array", async () => {
            const { client, nativeConnection } = testEnv;
            const taskQueue = "test-example-workflow-empty";

            const activities = {
                processObjectActivity: (
                    _payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ProcessObjectResult> =>
                    Promise.resolve({ objectId: "", name: "", success: true }),
                getObjectMetadataActivity: (
                    _payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ObjectMetadata> =>
                    Promise.resolve({ objectId: "", name: "", properties: {} }),
            };

            const worker = await Worker.create({
                connection: nativeConnection,
                taskQueue,
                workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
                activities,
            });

            const payload = getMockWorkflowPayload({}, []);

            const result: ExampleWorkflowResult = await worker.runUntil(
                client.workflow.execute(exampleWorkflow, {
                    args: [payload],
                    workflowId: "test-example-workflow-empty",
                    taskQueue,
                })
            );

            expect(result.processedObjects).toBe(0);
            expect(result.results).toHaveLength(0);
        });
    });

    describe("inspectObjectsWorkflow", () => {
        it("successfully retrieves metadata for multiple objects", async () => {
            const { client, nativeConnection } = testEnv;
            const taskQueue = "test-inspect-workflow";

            const mockMetadata: Record<string, ObjectMetadata> = {
                "object-1": {
                    objectId: "object-1",
                    name: "Document 1",
                    type: "Report",
                    properties: { author: "Alice" },
                },
                "object-2": {
                    objectId: "object-2",
                    name: "Document 2",
                    type: "Article",
                    properties: { author: "Bob" },
                },
            };

            const activities = {
                processObjectActivity: (
                    _payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ProcessObjectResult> =>
                    Promise.resolve({ objectId: "", name: "", success: true }),
                getObjectMetadataActivity: (
                    payload: ActivityExecutionPayload<ProcessObjectParams>
                ): Promise<ObjectMetadata> =>
                    Promise.resolve(mockMetadata[payload.params.objectId]),
            };

            const worker = await Worker.create({
                connection: nativeConnection,
                taskQueue,
                workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
                activities,
            });

            const payload = getMockWorkflowPayload({}, ["object-1", "object-2"]);

            const result = await worker.runUntil(
                client.workflow.execute(inspectObjectsWorkflow, {
                    args: [payload],
                    workflowId: "test-inspect-workflow",
                    taskQueue,
                })
            );

            expect(result.objects).toHaveLength(2);
            expect(result.objects[0]).toEqual({
                objectId: "object-1",
                name: "Document 1",
                type: "Report",
                properties: { author: "Alice" },
            });
            expect(result.objects[1]).toEqual({
                objectId: "object-2",
                name: "Document 2",
                type: "Article",
                properties: { author: "Bob" },
            });
        });
    });
});
