import type * as Wire from './wire-types.generated.js';

// The unified project-scoped tool registry, inferred from `./api-schemas/tools.js`. The
// documentation for each member lives on the schema, which is what the OpenAPI document publishes.

export type ToolSource = Wire.ToolSource;

export type AggregatedTool = Wire.AggregatedTool;

export type ToolRuntimeContext = Wire.ToolRuntimeContext;

export type ProcessToolCompatibilityReason = Wire.ProcessToolCompatibilityReason;

export type ProcessToolCompatibility = Wire.ProcessToolCompatibility;

export type InspectProjectToolQuery = Wire.InspectProjectToolQuery;

export type ToolInspection = Wire.ToolInspection;

export type ListProjectToolsQuery = Wire.ListProjectToolsQuery;

export type ToolValidationResult = Wire.ToolValidationResult;

export type ValidateToolNamesPayload = Wire.ValidateToolNamesPayload;

export type ValidateToolNamesResponse = Wire.ValidateToolNamesResponse;
