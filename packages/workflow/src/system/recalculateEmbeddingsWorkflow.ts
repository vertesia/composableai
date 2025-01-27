
import { SupportedEmbeddingTypes, WorkflowExecutionPayload } from "@vertesia/common";
import * as activities from "../activities/index-dsl.js";
import { dslProxyActivities } from "../dsl/dslProxyActivities.js";
import { NoDocumentFound } from "../errors.js";

const {
    generateEmbeddings,
} = dslProxyActivities<typeof activities>("recalculateEmbeddingsWorkflow", {
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 10,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [NoDocumentFound.name],
    },
});

export async function recalculateEmbeddingsWorkflow(payload: WorkflowExecutionPayload) {

    const embeddings = [];

    for (const type of Object.values(SupportedEmbeddingTypes)) {
        embeddings.push(generateEmbeddings(payload, {
            force: true,
            type
        }))
    }

    const res = await Promise.all(embeddings);

    return res;

}