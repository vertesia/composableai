import { WorkflowExecutionPayload } from "@vertesia/common";
export { dslWorkflow } from "../dsl-workflow.js";

export async function testChildWorkflow(payload: WorkflowExecutionPayload) {
    return `Child: Hello, ${payload.vars.name}!`;
}
