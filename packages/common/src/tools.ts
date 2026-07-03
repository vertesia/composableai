import type { MCPToolAnnotations } from './apps.js';

/**
 * Origin of a tool in the unified project-scoped tool registry.
 *
 * - `builtin`: anything statically registered on the worker — workflow builtins, studio agent tools, and sys skills
 * - `app`: tools contributed by an installed app for the project
 * - `interaction`: a project interaction exposed via `tag=tool` / `is_tool=true` / `is_skill=true`
 *
 * Skill semantics (the tool unlocks others when invoked) are NOT part of the source. They are
 * identified universally by the `learn_` prefix in the tool name. This matches how the runtime
 * registry stores them and avoids splitting one logical origin into two sources.
 */
export type ToolSource = 'builtin' | 'app' | 'interaction';

/**
 * A single tool entry in the unified registry, regardless of where it came from.
 * Returned by `GET /tools` and the resolution map of `POST /tools/validate`.
 */
export interface AggregatedTool {
    /** Name as referenced from `agent_runner_options.tool_names`. For interaction skills this is `learn_<endpoint>`. */
    name: string;
    source: ToolSource;
    description?: string;
    title?: string;
    /** Whether the tool is part of the default toolkit when no explicit `tool_names` is provided. */
    is_default?: boolean;
    annotations?: MCPToolAnnotations;
    /** For skills (`learn_*`): tool names this skill unlocks when invoked. */
    unlocked_tools?: string[];
    /** Present when `source === 'app'`: the app installation that provides this tool. */
    app_install_id?: string;
    /** Present when `source === 'app'`: the app's manifest name (used for `principal.apps` filtering). */
    app_name?: string;
    /** Present when `source === 'interaction'`: the interaction document id. */
    interaction_id?: string;
    /**
     * Present when `source === 'interaction'`: true if the interaction has
     * `agent_runner_options.is_agent === true`. Lets UI consumers distinguish
     * sub-agents (autonomous, run-to-completion) from regular interaction tools.
     */
    is_agent?: boolean;
}

/**
 * Optional filters for `GET /tools`.
 *
 * The resolution is `(sources ?? ALL) − exclude`:
 *  - `sources` alone: include only the listed sources
 *  - `exclude` alone: include all sources except the listed ones
 *  - Both: start from `sources`, then remove `exclude`
 *  - Neither: include all sources
 *
 * Sources that are filtered out are not fetched, so passing `exclude=['app']` skips
 * the app round-trips entirely.
 */
export interface ListProjectToolsQuery {
    /** Include only these sources. */
    sources?: ToolSource[];
    /** Drop these sources from the result (and skip their fetch). Applied after `sources`. */
    exclude?: ToolSource[];
}

/**
 * Per-name resolution result for `POST /tools/validate`.
 */
export interface ToolValidationResult {
    /** The name the caller asked about. */
    name: string;
    /** True if the name resolves to exactly one tool in the project's unified registry. */
    valid: boolean;
    /** When `valid`: which source the tool came from. */
    source?: ToolSource;
    /** When `valid` and `source === 'app'`: the app installation that provides the tool. */
    app_install_id?: string;
    /** When `valid` and `source === 'app'`: the app's manifest name. */
    app_name?: string;
    /** When `!valid` and a close match exists: the suggested replacement name (Levenshtein-based). */
    suggestion?: string;
    /**
     * Populated when a name appears in more than one source. Validation does not fail on this,
     * but exposes the ambiguity so callers can surface a warning (last-write-wins resolution applies).
     */
    collisions?: Array<{ source: ToolSource; app_install_id?: string }>;
}

/**
 * Request payload for `POST /tools/validate`.
 */
export interface ValidateToolNamesPayload {
    /** Bare tool names as they appear in `agent_runner_options.tool_names`. `+`/`-` prefixes are stripped before lookup. */
    names: string[];
}

/**
 * Response from `POST /tools/validate`.
 */
export interface ValidateToolNamesResponse {
    /** One entry per requested name, in the same order. */
    results: ToolValidationResult[];
    /** Convenience count of `results.filter(r => !r.valid).length`. */
    invalid_count: number;
}
