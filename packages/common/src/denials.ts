/**
 * @module denials
 * @description
 * Pattern-based access denials carried in the JWT, plus helpers to match them
 * against runtime UI and tool identifiers.
 *
 * Denials are scoped by kind. Each kind has its own pattern grammar:
 *
 * - `ui:<glob>` — denies a UI plugin. The matched identifier is the app name
 *   (a single segment). Glob supports `*` as wildcard. Examples:
 *     - `slack-app`         → denies exactly this app
 *     - `admin-*`           → denies any app whose name starts with `admin-`
 *
 * - `tool:<glob>` — denies a tool. The matched identifier is the 3-segment
 *   tool URI `<app-name>:<category>:<tool-name>`. Patterns are stored without
 *   the kind prefix (already grouped under `denials.tool`). Wildcards are
 *   supported per segment. Patterns may be expressed in 3 ways:
 *     - **Full** (2 colons): `app:collection:tool` — any segment may be `*` or
 *       contain `*` wildcards. Examples:
 *         - `slack:messaging:send_message`
 *         - `*:messaging:send_message`     (all apps with this tool name)
 *         - `slack:messaging:*`            (all tools in this collection)
 *     - **App-only** (1 colon, form `<app>:*`): expanded to `<app>:*:*`. Filters
 *       all tools from the given app. Example: `slack:*` denies every Slack tool.
 *     - **Tool-name** (0 colons): expanded to `*:*:<input>`. Filters by tool name
 *       across all apps/collections. Example: `data_*` denies any tool whose
 *       name starts with `data_`.
 *
 * Workflow builtin tools (think, plan, query_documents, …) are NOT matched —
 * they do not have an app/category and are not addressable through this
 * mechanism by design.
 */

/**
 * Pattern-based access denials carried in the JWT.
 *
 * Each top-level key is a contribution `kind` (`ui`, `tool`, `app`, …). The value
 * is an array of glob patterns hiding contributions of that kind from the
 * principal. Enforcers (UI shell, agent tool/skill discovery, server-side
 * installation listing) match against the slice for their kind.
 *
 * The `app` kind is a shortcut: it implicitly denies every kind for the matched
 * app. Each enforcer that checks `ui:` / `tool:` also checks `app:` — denying
 * `app:slack` is equivalent to denying its UI plugin, all its tools, and (when
 * server-side enforcement is applied) the entire installation listing entry.
 *
 * Future kinds may be added as new optional keys without breaking existing
 * consumers — unknown keys are ignored by their enforcer.
 */
export interface Denials {
    /** Patterns hiding UI plugins / routes. Enforced by the UI shell. */
    ui?: string[];
    /** Patterns hiding agent tools and skill loaders (`learn_*`). Enforced during tool discovery. */
    tool?: string[];
    /**
     * Patterns hiding entire apps. Implicitly denies every contribution kind for
     * the matched app. Matched against the app name as a single segment.
     * Enforced server-side (installation listings) and client-side (UI / tools).
     */
    app?: string[];
}

// ============================================================================
// Glob matching
// ============================================================================

/**
 * A compiled glob matcher. Takes a value, returns whether it matches.
 * Built by {@link compileSegment} once and reused for many values.
 */
type SegmentMatcher = (value: string) => boolean;

/**
 * Compile a glob pattern to a matcher function. Specializes common shapes to
 * native string ops; falls back to RegExp only for complex patterns (interior
 * or multiple wildcards). The compile cost is paid once per pattern.
 *
 * Shapes handled directly without RegExp:
 *   - `*`         → always true
 *   - `literal`   → equality
 *   - `prefix*`   → startsWith
 *   - `*suffix`   → endsWith
 *   - `*middle*`  → includes
 *
 * Anything else (e.g. `pre*mid*suf`, `mid*dle`) compiles to a RegExp.
 */
function compileSegment(pattern: string): SegmentMatcher {
    if (pattern === '*') return () => true;
    if (!pattern.includes('*')) return (v) => v === pattern;

    const parts = pattern.split('*');
    // 'prefix*'  →  startsWith
    if (parts.length === 2 && parts[1] === '') {
        const prefix = parts[0];
        return (v) => v.startsWith(prefix);
    }
    // '*suffix'  →  endsWith
    if (parts.length === 2 && parts[0] === '') {
        const suffix = parts[1];
        return (v) => v.endsWith(suffix);
    }
    // '*middle*'  →  includes
    if (parts.length === 3 && parts[0] === '' && parts[2] === '') {
        const substring = parts[1];
        return (v) => v.includes(substring);
    }

    // Fallback: interior or multiple wildcards — compile to RegExp once.
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return (v) => regex.test(v);
}

// ============================================================================
// Tool URI helpers
// ============================================================================

/**
 * Compose the canonical 3-segment tool URI from its identifying parts.
 * Missing category is represented as an empty segment so the URI still has
 * 3 parts (callers may match against it with `<app>::*` if they care).
 */
export function makeToolId(appName: string, category: string | undefined, toolName: string): string {
    return `${appName}:${category ?? ''}:${toolName}`;
}

/**
 * Expand a tool denial pattern to its canonical 3-segment form.
 * See module doc for the grammar.
 */
export function expandToolPattern(pattern: string): [string, string, string] {
    const s = pattern.split(':');
    if (s.length >= 3) return [s[0], s[1], s.slice(2).join(':')];
    if (s.length === 2) return [s[0], '*', '*'];
    return ['*', '*', s[0]];
}

// ============================================================================
// Public matching API
// ============================================================================

/**
 * One-shot check whether a tool URI is denied. For repeated checks against
 * the same denials, build a {@link DenialsMatcher} once and reuse it.
 */
export function isToolDenied(toolId: string, denials: Denials | undefined): boolean {
    return new DenialsMatcher(denials).isToolUriDenied(toolId);
}

/**
 * One-shot check whether a UI plugin (identified by app name) is denied.
 * For repeated checks, build a {@link DenialsMatcher} once and reuse it.
 */
export function isUiDenied(appName: string, denials: Denials | undefined): boolean {
    return new DenialsMatcher(denials).isUiDenied(appName);
}

/**
 * Filter a list of tool-like objects, removing those denied for the principal.
 * Thin convenience wrapper over {@link DenialsMatcher.filterTools}; allocates
 * one matcher per call. For repeated filters, reuse a matcher instance.
 */
export function filterDeniedTools<T extends { app_name: string; category?: string; name: string }>(
    tools: T[],
    denials: Denials | undefined,
): T[] {
    return new DenialsMatcher(denials).filterTools(tools);
}

// ============================================================================
// DenialsMatcher (cached)
// ============================================================================

interface CompiledToolPattern {
    app: SegmentMatcher;
    category: SegmentMatcher;
    tool: SegmentMatcher;
}

/**
 * Cached matcher for repeated denial checks against the same denials set.
 *
 * Patterns are compiled lazily on first use — constructing the matcher is free
 * (no work, no allocations beyond a wrapper object). The first call to a
 * matching method compiles the relevant pattern set; subsequent calls reuse
 * the compiled forms.
 *
 * Use this in hot paths (filtering many tools/UIs against the same denials).
 * For one-off checks the standalone {@link isToolDenied} / {@link isUiDenied}
 * functions are fine — they create a transient matcher internally.
 *
 * @example
 * ```ts
 * const matcher = new DenialsMatcher(authToken.denials);
 * const visibleTools = allTools.filter(t =>
 *     !matcher.isToolDenied(t.app_name, t.category, t.name)
 * );
 * const visiblePlugins = plugins.filter(p => !matcher.isUiDenied(p.name));
 * ```
 */
export class DenialsMatcher {
    private readonly denials: Denials | undefined;
    private uiCompiled?: SegmentMatcher[];
    private toolCompiled?: CompiledToolPattern[];
    private appCompiled?: SegmentMatcher[];

    constructor(denials: Denials | undefined) {
        this.denials = denials;
    }

    /** True if there are any tool denials configured. */
    get hasToolDenials(): boolean {
        return !!this.denials?.tool?.length;
    }

    /** True if there are any UI denials configured. */
    get hasUiDenials(): boolean {
        return !!this.denials?.ui?.length;
    }

    /** True if there are any whole-app denials configured. */
    get hasAppDenials(): boolean {
        return !!this.denials?.app?.length;
    }

    /**
     * Check whether the entire app is denied (matches an `app:` pattern). Use
     * this when filtering installation listings server-side — `ui:` denials
     * should not hide an installation, only its UI plugin entry.
     */
    isAppDenied(appName: string): boolean {
        if (!this.hasAppDenials) return false;
        this.appCompiled ??= this.denials!.app!.map(compileSegment);
        return this.appCompiled.some(m => m(appName));
    }

    /**
     * Check whether a tool is denied. Checks `tool:` patterns and also `app:`
     * patterns — denying the whole app implicitly denies all its tools.
     *
     * Prefer this overload — passing the parts avoids string-building +
     * splitting for every call.
     */
    isToolDenied(appName: string, category: string | undefined, toolName: string): boolean {
        if (!this.hasToolDenials && !this.hasAppDenials) return false;
        if (this.isAppDenied(appName)) return true;
        if (!this.hasToolDenials) return false;
        const compiled = this.compileToolPatterns();
        const cat = category ?? '';
        return compiled.some(p => p.app(appName) && p.category(cat) && p.tool(toolName));
    }

    /**
     * Convenience overload accepting a pre-built tool URI. Slightly slower
     * than the parts overload because it has to split the URI.
     */
    isToolUriDenied(toolId: string): boolean {
        if (!this.hasToolDenials && !this.hasAppDenials) return false;
        const segs = toolId.split(':');
        if (segs.length !== 3) return false;
        return this.isToolDenied(segs[0], segs[1], segs[2]);
    }

    /**
     * Check whether a UI plugin (identified by app name) is denied. Checks
     * `ui:` patterns and also `app:` patterns — denying the whole app
     * implicitly denies its UI plugin.
     */
    isUiDenied(appName: string): boolean {
        if (!this.hasUiDenials && !this.hasAppDenials) return false;
        if (this.isAppDenied(appName)) return true;
        if (!this.hasUiDenials) return false;
        this.uiCompiled ??= this.denials!.ui!.map(compileSegment);
        return this.uiCompiled.some(m => m(appName));
    }

    /** Filter an array of tool-like objects, removing denied ones. */
    filterTools<T extends { app_name: string; category?: string; name: string }>(tools: T[]): T[] {
        if (!this.hasToolDenials && !this.hasAppDenials) return tools;
        return tools.filter(t => !this.isToolDenied(t.app_name, t.category, t.name));
    }

    /**
     * Static sugar: filter once without explicitly constructing a matcher.
     * Equivalent to `new DenialsMatcher(denials).filterTools(tools)`. Prefer
     * the instance form when you need to filter against the same denials more
     * than once.
     */
    static filterTools<T extends { app_name: string; category?: string; name: string }>(
        tools: T[],
        denials: Denials | undefined,
    ): T[] {
        return new DenialsMatcher(denials).filterTools(tools);
    }

    private compileToolPatterns(): CompiledToolPattern[] {
        if (!this.toolCompiled) {
            this.toolCompiled = this.denials!.tool!.map(pattern => {
                const [a, c, t] = expandToolPattern(pattern);
                return {
                    app: compileSegment(a),
                    category: compileSegment(c),
                    tool: compileSegment(t),
                };
            });
        }
        return this.toolCompiled;
    }
}
