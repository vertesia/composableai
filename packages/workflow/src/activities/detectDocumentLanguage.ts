import { log } from '@temporalio/activity';
import type { DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { type TruncateSpec, truncByMaxTokens } from '../utils/tokens.js';
import { executeInteractionFromActivity, type InteractionExecutionParams } from './executeInteraction.js';

const INT_DETECT_LANGUAGE = 'sys:DetectLanguage';

// The first ~3 pages of text are plenty to identify the language; keep the call small and cheap.
const DEFAULT_FIRST_PAGES_MAX_TOKENS = 2500;

const LANGUAGE_RESULT_SCHEMA: InteractionExecutionParams['result_schema'] = {
    type: 'object',
    properties: {
        languages: { type: 'array', items: { type: 'string' } },
    },
    required: ['languages'],
};

export interface DetectDocumentLanguageParams extends InteractionExecutionParams {
    interactionName?: string;
    /** Truncate the document text to roughly the first pages before detecting the language. */
    truncate?: TruncateSpec;
}

export interface DetectDocumentLanguage extends DSLActivitySpec<DetectDocumentLanguageParams> {
    name: 'detectDocumentLanguage';
}

interface DetectLanguageResult {
    languages?: unknown;
}

/**
 * Detect the document language(s) from its first pages and store them in metadata.languages.
 *
 * A small, focused pass: it runs the sys:DetectLanguage interaction on a short text excerpt rather
 * than folding language into full property extraction (more reliable, and cheap). No-op when the
 * document has no text yet (e.g. media handled by the transcription path, which sets languages
 * itself).
 */
export async function detectDocumentLanguage(payload: DSLActivityExecutionPayload<DetectDocumentLanguageParams>) {
    const context = await setupActivity<DetectDocumentLanguageParams>(payload);
    const { params, client, objectId } = context;
    const interactionName = params.interactionName ?? INT_DETECT_LANGUAGE;

    const doc = await client.objects.retrieve(objectId, '+text');
    if (!doc?.text) {
        log.info(`detectDocumentLanguage: object ${objectId} has no text, skipping`);
        return { status: 'skipped', message: 'no-text' };
    }

    const content = truncByMaxTokens(doc.text, params.truncate ?? DEFAULT_FIRST_PAGES_MAX_TOKENS);

    let res: Awaited<ReturnType<typeof executeInteractionFromActivity>>;
    try {
        res = await executeInteractionFromActivity(
            client,
            interactionName,
            { ...params, result_schema: LANGUAGE_RESULT_SCHEMA },
            { content },
            payload.debug_mode ?? false,
        );
    } catch (error) {
        // Language detection is best-effort — never fail the whole intake over it.
        log.warn(`detectDocumentLanguage: detection failed for ${objectId}, skipping`, { error: String(error) });
        return { status: 'skipped', message: 'detection-failed' };
    }

    const result = res.result.object<DetectLanguageResult>();
    const languages = Array.isArray(result.languages)
        ? Array.from(
              new Set(
                  result.languages
                      .filter((lang): lang is string => typeof lang === 'string')
                      .map((lang) => lang.trim().toLowerCase())
                      .filter(Boolean),
              ),
          )
        : [];

    if (languages.length === 0) {
        log.warn(`detectDocumentLanguage: no language detected for ${objectId}`, { runId: res.id });
        return { status: 'completed', languages: [] };
    }

    // metadata-only update (not source/properties), so it won't re-trigger intake; suppress
    // workflows anyway for consistency with the other intake writes.
    await client.objects.update(objectId, { metadata: { ...doc.metadata, languages } }, { suppressWorkflows: true });

    log.info(`detectDocumentLanguage: set languages for ${objectId}`, { languages, runId: res.id });
    return { status: 'completed', languages };
}
