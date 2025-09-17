import { DSLActivityExecutionPayload, RateLimitRequestPayload } from "@vertesia/common";
import { activityInfo, log } from "@temporalio/activity";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

export interface RateLimitParams {
  interactionIdOrEndpoint: string;
  environmentId?: string;
  modelId?: string;
}

export interface RateLimitResult {
  delayMs: number;
}

export async function checkRateLimit(payload: DSLActivityExecutionPayload<RateLimitParams>): Promise<RateLimitResult> {
  const { client, params } = await setupActivity<RateLimitParams>(payload);
  const { environmentId, modelId } = params;
  
  const result: RateLimitResult = {
    delayMs: 0,
  }

  try {
    // Call the studio-server endpoint to get rate limit delay using the Vertesia client
    const info = activityInfo();
    const requestPayload: RateLimitRequestPayload = {
      interaction: params.interactionIdOrEndpoint,
      workflow_run_id: info.workflowExecution.runId,
      environment_id: environmentId,
      model_id: modelId,
    };
    
    const response = await client.interactions.requestSlot(requestPayload);
    result.delayMs = response.delay_ms;
  } catch (error) {
    log.warn('Failed to call rate limit API:', {error});
    throw error;
  }

  return result;
}