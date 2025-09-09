import { DSLActivityExecutionPayload } from "@vertesia/common";
import { activityInfo, log } from "@temporalio/activity";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

export interface RateLimitParams {
  environmentId?: string;
  interactionId?: string;
  modelId?: string;
}

export interface RateLimitResult {
  delayMs: number;
}

async function resolveEnvironmentAndModel(
  payload: DSLActivityExecutionPayload<RateLimitParams>,
  params: RateLimitParams
): Promise<{ environmentId: string | null; modelId: string | null }> {
  const { fetchProject, client } = await setupActivity(payload);
  let environmentId = params.environmentId || null;
  let modelId = params.modelId || null;

  if (!environmentId && params.interactionId) {
    if (params.interactionId.includes(':')) {
      try {
        const project = await fetchProject();
        environmentId = project?.configuration?.default_environment?.toString() || null;
        modelId = project?.configuration?.default_model?.toString() || null;
      } catch (error) {
        log.warn('Failed to fetch project for environment resolution:', { error });
      }
    } else {
      try {
        const interaction = await client.interactions.get(params.interactionId);
        environmentId = interaction.default_environment_id || null;
        if (interaction.default_model_id) {
          modelId = interaction.default_model_id;
        } else {
          const environment = await client.environments.get(interaction.default_environment_id);
          modelId = environment?.default_model?.toString() || null;
        }
      } catch (error) {
        log.warn('Failed to fetch interaction for environment/model resolution:', { error });
      }
    }
  }

  return { environmentId, modelId };
}

export async function checkRateLimit(payload: DSLActivityExecutionPayload<RateLimitParams>): Promise<RateLimitResult> {
  const { client, params } = await setupActivity<RateLimitParams>(payload);
  const { environmentId, modelId } = await resolveEnvironmentAndModel(payload, params);
  
  const result: RateLimitResult = {
    delayMs: 0,
  }

  if (!environmentId) {
    log.warn('No environment ID could be resolved for rate limiting');
  } else {
      try {
      // Call the studio-server endpoint to get rate limit delay using the Vertesia client
      const info = activityInfo();
      const requestPayload: any = {
        run_id: info.workflowExecution.runId,
        environment_id: environmentId
      };
      
      if (modelId) {
        requestPayload.model_id = modelId;
      }
      
      const response = await client.post('/api/v1/execute/rate-limit/request', {
        payload: requestPayload
      }) as { delay_ms: number };
      result.delayMs = response.delay_ms;
    } catch (error) {
      log.warn('Failed to call rate limit API:', {error});
    }
  }

  log.info('Rate limit check result:', { delayMs: result.delayMs, environmentId, modelId });
  return result;
}