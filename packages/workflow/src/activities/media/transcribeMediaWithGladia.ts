import { DSLActivityExecutionPayload, DSLActivitySpec, GladiaConfiguration, SupportedIntegrations } from "@vertesia/common";
import { activityInfo, CompleteAsyncError, log } from "@temporalio/activity";
import { FetchClient } from "@vertesia/api-fetch-client";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { NoDocumentFound } from "../../errors.js";
import { TextExtractionResult, TextExtractionStatus } from "../../index.js";


export interface TranscriptMediaParams {
    environmentId?: string;
    force?: boolean;
}

export interface TranscriptMedia extends DSLActivitySpec<TranscriptMediaParams> {
    name: 'TranscribeMedia';
}

export interface TranscriptMediaResult extends TextExtractionResult {
    message?: string;
}

const GLADIA_URL = "https://api.gladia.io/v2";

export async function transcribeMedia(payload: DSLActivityExecutionPayload<TranscriptMediaParams>): Promise<TranscriptMediaResult> {

    const { params, client, objectId } = await setupActivity<TranscriptMediaParams>(payload);

    const gladiaConfig = await client.projects.integrations.retrieve(payload.project_id, SupportedIntegrations.gladia) as GladiaConfiguration | undefined;
    if (!gladiaConfig || !gladiaConfig.enabled) {
        throw new NoDocumentFound("Gladia integration not enabled");
    }

    const object = await client.objects.retrieve(objectId, "+text");
    const gladiaClient = new FetchClient(gladiaConfig.url ?? GLADIA_URL);
    gladiaClient.withHeaders({ "x-gladia-key": gladiaConfig.api_key });

    if (object.text && !params.force) {
        return { hasText: true, objectId, status: TextExtractionStatus.skipped, message: "text already present and force not enabled" }
    }

    if (!object.content?.source) {
        throw new NoDocumentFound(`No source found for object ${objectId}`);
    }

    const mediaUrl = await client.store.objects.getContentSource(objectId).then(res => res.source);

    if (!mediaUrl) {
        throw new NoDocumentFound(`Error fetching source ${object.content.source}`);
    }

    const taskToken = Buffer.from(activityInfo().taskToken).toString('base64url');
    const callbackUrl = generateCallbackUrlForGladia(client.store.baseUrl, payload.auth_token, taskToken, objectId);

    log.info(`Transcribing media ${mediaUrl} with Gladia`, { objectId, callbackUrl });

    const res = await gladiaClient.post("/transcription", {
        payload: {
            audio_url: mediaUrl,
            callback_url: callbackUrl,
            diarization_enhanced: true,
            enable_code_switching: true,
            subtitles: true,
            subtitles_config: {
                formats: ["vtt"],
            }
        }
    }) as GladiaTranscriptRequestResponse;

    log.info(`Transcription request sent to Gladia`, { objectId, res });

    throw new CompleteAsyncError();

}


function generateCallbackUrlForGladia(baseUrl: string, authToken: string, taskToken: string, objectId: string) {
    return `${baseUrl}/api/v1/webhooks/gladia/${objectId}?access_token=${authToken}&task_token=${taskToken}`;
}

interface GladiaTranscriptRequestResponse {
    id: string;
    result_url: string;
}
