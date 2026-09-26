import type { z } from 'zod';
import type {
    AgentRunAnalysisSettingsSchema,
    AgentRunAnalysisSnapshotSchema,
    AgentRunInferenceSettingsSchema,
    AgentRunInferenceSnapshotSchema,
    AgentRunSettingsSchema,
    AgentRunSettingsSnapshotSchema,
    AgentRunToolSettingsSchema,
    AgentRunToolSettingsSnapshotSchema,
} from './api-schemas/agent-run-settings.js';

export type AgentRunInferenceSettings = z.infer<typeof AgentRunInferenceSettingsSchema>;
export type AgentRunAnalysisSettings = z.infer<typeof AgentRunAnalysisSettingsSchema>;
export type AgentRunToolSettings = z.infer<typeof AgentRunToolSettingsSchema>;
export type AgentRunSettings = z.infer<typeof AgentRunSettingsSchema>;
export type AgentRunInferenceSnapshot = z.infer<typeof AgentRunInferenceSnapshotSchema>;
export type AgentRunAnalysisSnapshot = z.infer<typeof AgentRunAnalysisSnapshotSchema>;
export type AgentRunToolSettingsSnapshot = z.infer<typeof AgentRunToolSettingsSnapshotSchema>;
export type AgentRunSettingsSnapshot = z.infer<typeof AgentRunSettingsSnapshotSchema>;
