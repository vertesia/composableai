/**
 * Type definitions shared across the Vertesia build-tools pipeline:
 * transformers, transformer results, and asset metadata produced by them.
 */

import type { z } from 'zod';

/**
 * Asset file to be copied during build
 */
export interface AssetFile {
    /** Source file path (absolute) */
    sourcePath: string;

    /** Relative destination path within assets directory */
    destPath: string;

    /** Asset type for categorization */
    type: 'script' | 'template';
}

/**
 * Result of a transform function
 */
export interface TransformResult {
    /** The data to export (can be text or JSON object) */
    data: unknown;

    /** Optional: additional imports to inject at the top of the generated module */
    imports?: string[];

    /** Optional: custom code to generate instead of default JSON export */
    code?: string;

    /** Optional: additional asset files to copy */
    assets?: AssetFile[];

    /** Optional: widget metadata for compilation */
    widgets?: Array<{ name: string; path: string }>;
}

/**
 * Transform function that converts file content into exportable data
 */
export type TransformFunction = (content: string, filePath: string) => TransformResult | Promise<TransformResult>;

/**
 * Configuration for a single import transformer rule
 */
export interface TransformerRule {
    /** Pattern to match import paths (e.g., /\.md\?skill$/ or /\?raw$/) */
    pattern: RegExp;

    /** Transform function to convert file content */
    transform: TransformFunction;

    /** Optional: Zod schema for validation */
    schema?: z.ZodType<unknown>;

    /** Optional: If true, the transformer generates virtual modules (no file to read) */
    virtual?: boolean;

    /** Optional: additional options for this transformer */
    options?: Record<string, unknown>;
}

/**
 * Type for transformer presets — alias for `TransformerRule` used by the
 * built-in preset modules (skill, raw, prompt, template, …).
 */
export type TransformerPreset = TransformerRule;
