/**
 * Type definitions for the Vertesia Rollup Import Plugin
 */

import type { Plugin } from 'rollup';
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
export type TransformFunction = (
    content: string,
    filePath: string
) => TransformResult | Promise<TransformResult>;

/**
 * Configuration for a single import transformer rule
 */
export interface TransformerRule {
    /** Pattern to match import paths (e.g., /\.md\?skill$/ or /\?raw$/) */
    pattern: RegExp;

    /** Transform function to convert file content */
    transform: TransformFunction;

    /** Optional: Zod schema for validation */
    schema?: z.ZodType<any>;

    /** Optional: If true, the transformer generates virtual modules (no file to read) */
    virtual?: boolean;

    /** Optional: additional options for this transformer */
    options?: Record<string, unknown>;
}

/**
 * Widget compilation configuration
 */
export interface WidgetConfig {
    /**
     * External dependencies that should not be bundled
     * Default: ['react', 'react-dom', 'react/jsx-runtime']
     */
    external?: string[];

    /**
     * Path to tsconfig.json for widget compilation
     * Default: './tsconfig.json'
     */
    tsconfig?: string;

    /**
     * Additional options to pass to @rollup/plugin-typescript
     */
    typescript?: Record<string, unknown>;

    /**
     * Minify widget output
     * Default: false
     */
    minify?: boolean;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
    /** Array of transformer rules to apply */
    transformers: TransformerRule[];

    /**
     * Root directory for asset output (scripts, widgets, etc.)
     * - If specified: assets will be copied to this directory
     * - If false: asset copying is disabled
     * - Default: './dist'
     */
    assetsDir?: string | false;

    /**
     * Directory for script files relative to assetsDir
     * Default: 'scripts'
     */
    scriptsDir?: string;

    /**
     * Directory for widget files relative to assetsDir
     * Default: 'widgets'
     */
    widgetsDir?: string;

    /**
     * Widget compilation configuration
     * If provided, discovered widgets will be automatically compiled
     */
    widgetConfig?: WidgetConfig;
}

/**
 * Type for transformer presets
 */
export type TransformerPreset = TransformerRule;

/**
 * Plugin factory return type
 */
export type VertesiaImportPlugin = (config: PluginConfig) => Plugin;
