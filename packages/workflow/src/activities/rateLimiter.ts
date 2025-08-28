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
    if (params.interactionId.includes(':')) {
      try {
        const { fetchProject } = await setupActivity(payload);
        const project = await fetchProject();
        return project?.configuration?.default_environment?.toString() || null;
      } catch (error) {
        log.warn('Failed to fetch project for environment resolution:', { error });
        return null;
      }
    } else {
      try {
        const { client } = await setupActivity(payload);
        const interaction = await client.interactions.get(params.interactionId);
        return interaction.default_environment_id || null;
      } catch (error) {
        log.warn('Failed to fetch interaction for environment resolution:', { error });
        return null;
      }
    }
  }

  return null;
}

export async function checkRateLimit(payload: DSLActivityExecutionPayload<RateLimitParams>): Promise<RateLimitResult> {
  const { client, params } = await setupActivity<RateLimitParams>(payload);
  const environmentId = await resolveEnvironmentId(payload, params);
  
  const result: RateLimitResult = {
    delayMs: 0,
  }

  if (!environmentId) {
    log.warn('No environment ID could be resolved for rate limiting');
  } else {
      try {
      // Call the studio-server endpoint to get rate limit delay using the Vertesia client
      const info = activityInfo();
      const response = await client.post('/api/v1/execute/rate-limit/request', {
        payload: {
          runId: info.workflowExecution.runId,
          environmentId: environmentId
        }
      }) as { delayMs: number };
      result.delayMs = response.delayMs;
    } catch (error) {
      log.warn('Failed to call rate limit API:', {error});
    }
  }

  log.info('Rate limit check result:', { delayMs: result.delayMs, environmentId });
  return result;
}