import { DSLActivityExecutionPayload } from "@vertesia/common";
import { activityInfo, log } from "@temporalio/activity";

export interface RateLimitParams {
  // just for the activity catalog to not break the build
}

export interface RateLimitResult {
  delayMs: number;
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
        workflowId: info.workflowExecution.workflowId,
        runId: info.workflowExecution.runId
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

export async function recordComplete(payload: DSLActivityExecutionPayload<RateLimitParams>): Promise<void> {

  // Get the store URL from config, fallback to environment variable
  const storeUrl = payload.config?.store_url || process.env.STORE_URL;

  try {
    // Call the zeno-server endpoint to record workflow completion
    const response = await fetch(`${storeUrl}/api/v1/workflows/rate-limit/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${payload.auth_token}`
      }
    });

    if (!response.ok) {
      log.warn(`Rate limit API returned ${response.status}: ${response.statusText}`);
      // If API fails, just return success
    }
  } catch (error) {
    log.warn('Failed to call rate limit API:', {error});
    // If API call fails, just return success
    return;
  }
}