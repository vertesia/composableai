import type { z } from 'zod';
import type {
    AggregatedToolSchema,
    ListProjectToolsQuerySchema,
    ToolSourceSchema,
    ToolValidationResultSchema,
    ValidateToolNamesPayloadSchema,
    ValidateToolNamesResponseSchema,
} from './api-schemas/tools.js';

// The unified project-scoped tool registry, inferred from `./api-schemas/tools.js`. The
// documentation for each member lives on the schema, which is what the OpenAPI document publishes.

export type ToolSource = z.infer<typeof ToolSourceSchema>;

export type AggregatedTool = z.infer<typeof AggregatedToolSchema>;

export type ListProjectToolsQuery = z.infer<typeof ListProjectToolsQuerySchema>;

export type ToolValidationResult = z.infer<typeof ToolValidationResultSchema>;

export type ValidateToolNamesPayload = z.infer<typeof ValidateToolNamesPayloadSchema>;

export type ValidateToolNamesResponse = z.infer<typeof ValidateToolNamesResponseSchema>;
