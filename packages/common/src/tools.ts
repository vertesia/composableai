import type { z } from 'zod';
import type {
    AggregatedToolSchema,
    InspectProjectToolQuerySchema,
    ListProjectToolsQuerySchema,
    ProcessToolCompatibilityReasonSchema,
    ProcessToolCompatibilitySchema,
    ToolInspectionSchema,
    ToolRuntimeContextSchema,
    ToolSourceSchema,
    ToolValidationResultSchema,
    ValidateToolNamesPayloadSchema,
    ValidateToolNamesResponseSchema,
} from './api-schemas/tools.js';

// The unified project-scoped tool registry, inferred from `./api-schemas/tools.js`. The
// documentation for each member lives on the schema, which is what the OpenAPI document publishes.

export type ToolSource = z.infer<typeof ToolSourceSchema>;

export type AggregatedTool = z.infer<typeof AggregatedToolSchema>;

export type ToolRuntimeContext = z.infer<typeof ToolRuntimeContextSchema>;

export type ProcessToolCompatibilityReason = z.infer<typeof ProcessToolCompatibilityReasonSchema>;

export type ProcessToolCompatibility = z.infer<typeof ProcessToolCompatibilitySchema>;

export type InspectProjectToolQuery = z.infer<typeof InspectProjectToolQuerySchema>;

export type ToolInspection = z.infer<typeof ToolInspectionSchema>;

export type ListProjectToolsQuery = z.infer<typeof ListProjectToolsQuerySchema>;

export type ToolValidationResult = z.infer<typeof ToolValidationResultSchema>;

export type ValidateToolNamesPayload = z.infer<typeof ValidateToolNamesPayloadSchema>;

export type ValidateToolNamesResponse = z.infer<typeof ValidateToolNamesResponseSchema>;
