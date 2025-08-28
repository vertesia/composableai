import { DSLActivityExecutionPayload } from "@vertesia/common";
import { activityInfo, log } from "@temporalio/activity";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

export interface RateLimitParams {
  environmentId?: string;
  interactionId?: string;
}

export interface RateLimitResult {
  delayMs: number;
}

async function resolveEnvironmentId(
  payload: DSLActivityExecutionPayload<RateLimitParams>,
  params: RateLimitParams
): Promise<string | null> {
  if (params.environmentId) {
    return params.environmentId;
  }

  if (params.interactionId) {
    try {
      const { client } = await setupActivity(payload);
      const interaction = await client.interactions.get(params.interactionId);
      return interaction.default_environment_id || null;
    } catch (error) {
      log.warn('Failed to fetch interaction for environment resolution:', { error });
      return null;
    }
  }

  return null;
}

export async function checkRateLimit(payload: DSLActivityExecutionPayload<RateLimitParams>): Promise<RateLimitResult> {
  const { client, params } = await setupActivity<RateLimitParams>(payload);
  const environmentId = await resolveEnvironmentId(payload, params);
  
  if (!environmentId) {
    log.warn('No environment ID could be resolved for rate limiting');
    return {
      delayMs: 0,
    };
  }

  const info = activityInfo();
  
  try {
    // Call the studio-server endpoint to get rate limit delay using the Vertesia client
    const result = await client.post('/api/v1/execute/rate-limit/request', {
      payload: {
        runId: info.workflowExecution.runId,
        environmentId: environmentId
      }
    }) as { delayMs: number };

    return {
      delayMs: result.delayMs
    };
  } catch (error) {
    log.warn('Failed to call rate limit API:', {error});
    // If API call fails, allow the request without delay
    return {
      delayMs: 0
    };
  }
}