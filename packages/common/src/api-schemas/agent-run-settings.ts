import { ModelOptionsSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import { InferenceProfileIdSchema, InferenceProfileSnapshotSchema } from './inference-profile.js';

export const AgentRunInferenceSettingsSchema = z
    .strictObject({
        inference_profile: InferenceProfileIdSchema,
    })
    .meta({ id: 'AgentRunInferenceSettings', description: 'An explicit inference profile pinned for this run.' });

export const AgentRunAnalysisSettingsSchema = z
    .strictObject({
        analysis: AgentRunInferenceSettingsSchema,
    })
    .meta({ id: 'AgentRunAnalysisSettings' });

export const AgentRunToolSettingsSchema = z
    .strictObject({
        web_fetch_serper: AgentRunAnalysisSettingsSchema.optional(),
        web_fetch_exa: AgentRunAnalysisSettingsSchema.optional(),
        web_fetch_linkup: AgentRunAnalysisSettingsSchema.optional(),
        fetch_document: AgentRunAnalysisSettingsSchema.optional(),
        search_documents: AgentRunAnalysisSettingsSchema.optional(),
    })
    .meta({
        id: 'AgentRunToolSettings',
        description: 'Settings for builtin analysis tools. MCP tools are not supported.',
    });

export const AgentRunSettingsSchema = z
    .strictObject({
        tools: AgentRunToolSettingsSchema.optional(),
        subagents: z
            .record(
                z.string().regex(/^(?:[a-fA-F0-9]{24}|sys:[A-Za-z0-9_]+|app:[A-Za-z0-9_-]+:[A-Za-z0-9_]+)$/),
                AgentRunInferenceSettingsSchema,
            )
            .optional()
            .meta({
                description:
                    'Up to 32 named agents, keyed by stable interaction ID (ObjectId, sys: or app: ID). Inherited by descendants.',
            }),
    })
    .meta({
        id: 'AgentRunSettings',
        description: 'Per-run tool and named-subagent inference settings, separate from model-generated arguments.',
    });

export const AgentRunInferenceSnapshotSchema = z
    .strictObject({
        inference_profile: InferenceProfileSnapshotSchema,
        environment: z.string(),
        model: z.string().min(1),
        model_options: ModelOptionsSchema.optional(),
    })
    .meta({
        id: 'AgentRunInferenceSnapshot',
        description:
            'Profile provenance and effective inference configuration resolved before launch. Reused on retries and restarts.',
    });

export const AgentRunAnalysisSnapshotSchema = z
    .strictObject({
        analysis: AgentRunInferenceSnapshotSchema,
    })
    .meta({ id: 'AgentRunAnalysisSnapshot' });

export const AgentRunToolSettingsSnapshotSchema = z
    .strictObject({
        web_fetch_serper: AgentRunAnalysisSnapshotSchema.optional(),
        web_fetch_exa: AgentRunAnalysisSnapshotSchema.optional(),
        web_fetch_linkup: AgentRunAnalysisSnapshotSchema.optional(),
        fetch_document: AgentRunAnalysisSnapshotSchema.optional(),
        search_documents: AgentRunAnalysisSnapshotSchema.optional(),
    })
    .meta({ id: 'AgentRunToolSettingsSnapshot' });

export const AgentRunSettingsSnapshotSchema = z
    .strictObject({
        tools: AgentRunToolSettingsSnapshotSchema.optional(),
        subagents: z.record(z.string(), AgentRunInferenceSnapshotSchema).optional(),
    })
    .meta({
        id: 'AgentRunSettingsSnapshot',
        description:
            'Server-resolved run settings. Subagent keys are canonical interaction IDs. Profile edits do not affect this snapshot.',
    });
