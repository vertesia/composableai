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
  // Get the store URL from config, fallback to environment variable
  const storeUrl = payload.config?.store_url || process.env.STORE_URL;

  if (!storeUrl) {
    log.warn('No store URL available for rate limit API');
    // If no store URL is available, allow the request without delay
    return {
      delayMs: 0,
    };
  }

  const { params } = await setupActivity<RateLimitParams>(payload);
  const environmentId = await resolveEnvironmentId(payload, params);
  
  if (!environmentId) {
    log.warn('No environment ID could be resolved for rate limiting');
    return {
      delayMs: 0,
    };
  }

  const info = activityInfo();
  
  try {
    // Call the zeno-server endpoint to get rate limit delay
    const response = await fetch(`${storeUrl}/api/v1/workflows/rate-limit/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${payload.auth_token}`
      },
      body: JSON.stringify({
        runId: info.workflowExecution.runId,
        environmentId: environmentId
      })
    });

    if (!response.ok) {
      log.warn(`Rate limit API returned ${response.status}: ${response.statusText}`);
      // If API fails, allow the request without delay
      return {
        delayMs: 0
      };
    }

    const result = await response.json() as { delayMs: number };

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