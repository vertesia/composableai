import { BaseObject } from "./common.js";

/**
 * Tool recommendation within a hive memory unit
 */
export interface HiveMemoryToolRecommendation {
    tool_name: string;
    guidance: string;
}

/**
 * Memory unit scope - project-scoped by default, can be elevated to account
 */
export type HiveMemoryScope = 'project' | 'account';

/**
 * Base interface for hive memory items (list/summary view)
 */
export interface HiveMemoryItem extends BaseObject {
    // Classification
    task_category: string;  // "document-analysis", "data-extraction", etc.
    domain?: string;        // "financial", "legal", etc.

    // Summary
    summary: string;

    // Tools involved in the learnings
    tools_involved: string[];

    // Quality metrics
    confidence_score: number;     // 0-1
    usage_count: number;
    success_correlation: number;  // correlation with successful runs
    contribution_count: number;   // number of runs that contributed

    // Scoping
    scope: HiveMemoryScope;
}

/**
 * Full hive memory unit with all learnings and patterns
 */
export interface HiveMemory extends HiveMemoryItem {
    // Objective patterns this memory applies to
    objective_patterns: string[];

    // Learnings
    general_learnings: string[];
    best_practices: string[];
    pitfalls_to_avoid: string[];
    tool_recommendations: HiveMemoryToolRecommendation[];

    // Vector search
    embedding?: number[];

    // Security field for granular permissions
    security?: Record<string, string[]>;
}

/**
 * Payload for creating a new hive memory unit
 */
export interface CreateHiveMemoryPayload {
    // Classification
    task_category: string;
    domain?: string;

    // Content
    summary: string;
    objective_patterns: string[];

    // Learnings
    general_learnings: string[];
    best_practices?: string[];
    pitfalls_to_avoid?: string[];
    tool_recommendations?: HiveMemoryToolRecommendation[];

    // Metadata
    tools_involved?: string[];

    // Quality (optional, defaults applied)
    confidence_score?: number;

    // Scoping
    scope?: HiveMemoryScope;

    // Standard fields
    name?: string;
    description?: string;
    tags?: string[];
}

/**
 * Payload for updating an existing hive memory unit
 */
export interface UpdateHiveMemoryPayload {
    // Classification updates
    task_category?: string;
    domain?: string;

    // Content updates
    summary?: string;

    // Array additions (merged with existing)
    add_objective_patterns?: string[];
    add_general_learnings?: string[];
    add_best_practices?: string[];
    add_pitfalls_to_avoid?: string[];
    add_tool_recommendations?: HiveMemoryToolRecommendation[];
    add_tools_involved?: string[];

    // Quality updates
    confidence_score?: number;
    increment_usage_count?: boolean;
    increment_contribution_count?: boolean;
    success_correlation?: number;

    // Scoping
    scope?: HiveMemoryScope;

    // Standard fields
    name?: string;
    description?: string;
    tags?: string[];
}

/**
 * Search parameters for finding relevant memories
 */
export interface HiveMemorySearchParams {
    // Semantic search
    query?: string;              // Natural language query
    embedding?: number[];        // Pre-computed embedding for vector search

    // Filters
    task_category?: string;
    domain?: string;
    tools_involved?: string[];
    scope?: HiveMemoryScope;
    min_confidence?: number;     // Minimum confidence score (0-1)

    // Pagination
    limit?: number;              // Default: 5
    offset?: number;
}

/**
 * Response from memory search
 */
export interface HiveMemorySearchResult {
    memories: HiveMemory[];
    total: number;
}

/**
 * Formatted memory for agent consumption
 */
export interface FormattedMemoryForAgent {
    category: string;
    domain?: string;
    summary: string;
    learnings: string[];
    best_practices: string[];
    pitfalls_to_avoid: string[];
    tool_guidance: { tool: string; guidance: string }[];
    confidence: number;
}
