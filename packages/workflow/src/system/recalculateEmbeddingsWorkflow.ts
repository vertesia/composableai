import { proxyActivities } from "@temporalio/workflow";

import { DSLActivitySpec, DSLWorkflowExecutionPayload, SupportedEmbeddingTypes } from "@vertesia/common";
import { GenerateEmbeddings } from "../activities/generateEmbeddings.js";
import * as activities from "../activities/index.js";
import { NoDocumentFound } from "../errors.js";

const {
    generateEmbeddings,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 10,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [NoDocumentFound.name],
    },
});

export async function recalculateEmbeddingsWorkflow(payload: DSLWorkflowExecutionPayload) {

    const embeddings = [];

    for (const type of Object.values(SupportedEmbeddingTypes)) {
        const activityConfig: DSLActivitySpec = {
            name: 'generateEmbeddings',
            params: {
                force: true,
                type
            },
        } satisfies GenerateEmbeddings;

        embeddings.push(generateEmbeddings({
            ...payload,
            params: {},
            workflow_name: 'recalculateEmbeddingsWorkflow',
            activity: activityConfig,
        }));
    }

    const res = await Promise.all(embeddings);

    return res;

}