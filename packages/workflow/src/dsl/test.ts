import { ContentObjectStatus, WorkflowExecutionPayload } from "@vertesia/common";
import * as activities2 from "../activities/index-dsl.js";
import { dslProxyActivities } from "./dslProxyActivities.js";

const workflowPayload: WorkflowExecutionPayload = {} as any;


const { setDocumentStatus } = dslProxyActivities<typeof activities2>("my_workflow");
setDocumentStatus(workflowPayload, {
    status: ContentObjectStatus.archived
});
