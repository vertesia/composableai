
import { SupportedEmbeddingTypes, WorkflowExecutionPayload } from "@vertesia/common";
import * as activities from "../activities/index-dsl.js";
import { dslProxyActivities } from "../dsl/dslProxyActivities.js";
import { WF_NON_RETRYABLE_ERRORS } from "../errors.js";

const {
    generateEmbeddings,
} = dslProxyActivities<typeof activities>("recalculateEmbeddingsWorkflow", {
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 10,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: WF_NON_RETRYABLE_ERRORS,
    },
});

export async function recalculateEmbeddingsWorkflow(payload: WorkflowExecutionPayload) {

    const embeddings = [];
    const payloadType = payload.vars?.type as SupportedEmbeddingTypes;

    if (payloadType && !Object.values(SupportedEmbeddingTypes).includes(payloadType)) {
        throw new Error("Embedding type must be text, image, or properties");
    }
    const types = payloadType ? [payloadType] : Object.values(SupportedEmbeddingTypes);

    for (const type of types) {
        embeddings.push(generateEmbeddings(payload, {
            force: true,
            type
        }))
    }

    const res = await Promise.all(embeddings);

    return res;

}