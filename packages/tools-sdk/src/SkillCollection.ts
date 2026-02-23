import { ToolDefinition } from "@llumiverse/common";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { join } from "path";
import { ToolContext } from "./server/types.js";
import type {
    CollectionProperties,
    ICollection,
    SkillContentType,
    SkillDefinition,
    SkillExecutionResult,
    ToolCollectionDefinition,
    ToolExecutionPayload,
    ToolExecutionResult,
    ToolUseContext,
} from "./types.js";
import { kebabCaseToTitle } from "./utils.js";
import { AgentToolDefinition } from "@vertesia/common";

export interface SkillCollectionProperties extends CollectionProperties {
    /**
     * The skills in this collection
     */
    skills: SkillDefinition[];
}

/**
 * Implements a skills collection endpoint.
 * Skills provide contextual instructions to agents.
 * They can be static (markdown) or dynamic (JST templates).
 */
export class SkillCollection implements ICollection<SkillDefinition> {
    /**
     * A kebab case collection name
     */
    name: string;
    /**
     * Optional title for UI display
     */
    title?: string;
    /**
     * Optional icon for UI display
     */
    icon?: string;
    /**
     * A short description
     */
    description?: string;
    /**
     * The skills in this collection
     */
    private skills: Map<string, SkillDefinition>;

    constructor({ name, title, icon, description, skills }: SkillCollectionProperties) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        this.skills = new Map(skills.map(s => [s.name, s]));
    }

    [Symbol.iterator](): Iterator<SkillDefinition> {
        return this.skills.values();
    }

    map<U>(callback: (skill: SkillDefinition, index: number) => U): U[] {
        return Array.from(this.skills.values()).map(callback);
    }

    /**
     * Get a skill by name
     */
    getSkill(name: string): SkillDefinition | undefined {
        return this.skills.get(name);
    }

    /**
     * Get all skill definitions
     */
    getSkillDefinitions(): SkillDefinition[] {
        return Array.from(this.skills.values());
    }

    /**
     * Get skills exposed as tool definitions.
     * This allows skills to appear alongside regular tools.
     * When called, they return rendered instructions.
     * Includes related_tools for dynamic tool discovery.
     */
    getToolDefinitions(filterContext?: ToolUseContext): AgentToolDefinition[] {
        const defaultSchema: ToolDefinition['input_schema'] = {
            type: 'object',
            properties: {
                context: {
                    type: "string",
                    description: "Additional context or specific requirements for this task"
                }
            }
        };

        let skills = Array.from(this.skills.values());
        if (filterContext) {
            skills = skills.filter(skill => {
                return skill.isEnabled ? skill.isEnabled(filterContext) : true;
            });
        }

        return skills.map(skill => {
            // Build description with related tools info if available
            let description = `[Skill] ${skill.description}. Returns contextual instructions for this task.`;
            if (skill.related_tools && skill.related_tools.length > 0) {
                description += ` Unlocks tools: ${skill.related_tools.join(', ')}.`;
            }

            return {
                url: `skills/${this.name}`,
                name: `learn_${skill.name}`,
                description,
                input_schema: skill.input_schema || defaultSchema,
                related_tools: skill.related_tools,
                category: this.name,
            };
        });
    }

    /**
     * Get as a tool collection definition (for listing alongside tools)
     */
    getAsToolCollection(baseUrl: string): ToolCollectionDefinition {
        return {
            title: this.title || this.name,
            description: this.description || `Skills: ${this.name}`,
            src: `${baseUrl}/api/skills/${this.name}`,
            tools: this.getToolDefinitions()
        };
    }

    getWidgets(): {
        name: string;
        skill: string;
    }[] {
        const out: {
            name: string;
            skill: string;
        }[] = [];
        for (const skill of this.skills.values()) {
            if (skill.widgets) {
                for (const widget of skill.widgets) {
                    out.push({
                        name: widget,
                        skill: skill.name,
                    });
                }
            }
        }
        return Array.from(out);
    }

    /**
     * Execute a skill - accepts standard tool execution payload.
     * Returns rendered instructions in tool result format.
     *
     * @param ctx - Hono context
     * @param preParsedPayload - Optional pre-parsed payload (used when routing from root endpoint)
     */
    async execute(ctx: Context, preParsedPayload?: ToolExecutionPayload<Record<string, any>>): Promise<Response> {
        const toolCtx = ctx as ToolContext;
        let payload: ToolExecutionPayload<Record<string, any>> | undefined = preParsedPayload;
        try {
            if (!payload) {
                // Check if body was already parsed and validated by middleware
                if (toolCtx.payload) {
                    payload = toolCtx.payload;
                } else {
                    throw new HTTPException(400, {
                        message: 'Invalid or missing skill execution payload. Expected { tool_use: { id, tool_name, tool_input? }, metadata? }'
                    });
                }
            }

            const toolName = payload.tool_use.tool_name;

            // Extract skill name from tool name (remove "learn_" prefix if present)
            const skillName = toolName.startsWith('learn_')
                ? toolName.replace('learn_', '')
                : toolName;

            const skill = this.skills.get(skillName);

            if (!skill) {
                console.warn("[SkillCollection] Skill not found", {
                    collection: this.name,
                    requestedSkill: skillName,
                    toolName,
                    availableSkills: Array.from(this.skills.keys()),
                });
                throw new HTTPException(404, {
                    message: `Skill not found: ${skillName}`
                });
            }

            const data = payload.tool_use.tool_input || {};
            const result = await this.renderSkill(skill, data);

            // TODO: If skill.execution is set, run via Daytona

            // Return in tool result format
            return ctx.json({
                tool_use_id: payload.tool_use.id,
                is_error: false,
                content: result.instructions,
                meta: {
                    skill_name: skill.name,
                    content_type: skill.content_type,
                    execution: skill.execution,
                }
            } satisfies ToolExecutionResult & { tool_use_id: string });
        } catch (err: any) {
            const status = err.status || 500;
            const toolName = payload?.tool_use?.tool_name;
            const toolUseId = payload?.tool_use?.id;

            if (status >= 500) {
                console.error("[SkillCollection] Skill execution failed", {
                    collection: this.name,
                    skill: toolName,
                    toolUseId,
                    error: err.message,
                    status,
                    toolInput: payload?.tool_use?.tool_input,
                    stack: err.stack,
                });
            }

            return ctx.json({
                tool_use_id: toolUseId || "unknown",
                is_error: true,
                content: err.message || "Error executing skill",
            }, status);
        }
    }

    /**
     * Render skill instructions (static or dynamic)
     */
    private async renderSkill(
        skill: SkillDefinition,
        _data: Record<string, unknown>
    ): Promise<SkillExecutionResult> {
        const instructions = skill.instructions;

        if (skill.content_type === 'jst') {
            // JST templates are not currently supported
            throw new HTTPException(501, {
                message: `JST templates are not currently supported. Use 'md' content type instead.`
            });
        }

        return {
            name: skill.name,
            instructions,
        };
    }
}

// ================== Skill Parser ==================

interface SkillFrontmatter {
    name: string;
    title?: string;
    description: string;
    keywords?: string[];
    tools?: string[];
    data_patterns?: string[];
    language?: string;
    packages?: string[];
    system_packages?: string[];
    widgets?: string[];
    scripts?: string[];
}

/**
 * Parse a SKILL.md or SKILL.jst file content into a SkillDefinition.
 *
 * Format:
 * ```
 * ---
 * name: skill-name
 * description: Short description
 * keywords: [keyword1, keyword2]
 * tools: [tool1, tool2]
 * language: python
 * packages: [numpy, pandas]
 * ---
 *
 * # Instructions
 *
 * Your markdown/jst content here...
 * ```
 */
export function parseSkillFile(
    content: string,
    contentType: SkillContentType
): SkillDefinition {
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
        throw new Error("Invalid skill file: missing YAML frontmatter");
    }

    const [, yamlContent, body] = frontmatterMatch;
    const frontmatter = parseYamlFrontmatter(yamlContent);
    const instructions = body.trim();

    if (!frontmatter.name) {
        throw new Error("Skill file missing required 'name' field");
    }
    if (!frontmatter.description) {
        throw new Error("Skill file missing required 'description' field");
    }

    const skill: SkillDefinition = {
        name: frontmatter.name,
        title: frontmatter.title,
        description: frontmatter.description,
        instructions,
        content_type: contentType,
        widgets: frontmatter.widgets || undefined,
        scripts: frontmatter.scripts || undefined,
    };

    // Build context triggers
    if (frontmatter.keywords || frontmatter.tools || frontmatter.data_patterns) {
        skill.context_triggers = {
            keywords: frontmatter.keywords,
            tool_names: frontmatter.tools,
            data_patterns: frontmatter.data_patterns,
        };
    }

    // Build execution config
    if (frontmatter.language) {
        skill.execution = {
            language: frontmatter.language,
            packages: frontmatter.packages,
            system_packages: frontmatter.system_packages,
        };

        // Extract code template from instructions if present
        const codeBlockMatch = instructions.match(/```(?:python|javascript|typescript|js|ts|py)\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            skill.execution.template = codeBlockMatch[1].trim();
        }
    }

    // Related tools from frontmatter
    if (frontmatter.tools) {
        skill.related_tools = frontmatter.tools;
    }

    return skill;
}

/**
 * Simple YAML frontmatter parser (handles basic key: value and arrays)
 */
function parseYamlFrontmatter(yaml: string): SkillFrontmatter {
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const key = trimmed.slice(0, colonIndex).trim();
        let value = trimmed.slice(colonIndex + 1).trim();

        // Handle array syntax: [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
            const items = value.slice(1, -1).split(',').map(s => s.trim());
            result[key] = items.filter(s => s.length > 0);
        } else {
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            result[key] = value;
        }
    }

    return result as SkillFrontmatter;
}

/**
 * Helper to load skill from file path (for Node.js usage)
 */
export async function loadSkillFromFile(
    filePath: string,
    fs: { readFile: (path: string, encoding: string) => Promise<string> }
): Promise<SkillDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const contentType: SkillContentType = filePath.endsWith('.jst') ? 'jst' : 'md';
    return parseSkillFile(content, contentType);
}

/**
 * Load all skills from a directory.
 * Scans for subdirectories containing SKILL.md files.
 *
 * Directory structure:
 * ```
 * skills/
 *   nagare/
 *     fund-onboarding/
 *       SKILL.md
 *     monte-carlo/
 *       SKILL.md
 * ```
 *
 * @param dirPath - Path to the skills collection directory
 * @returns Array of parsed skill definitions
 */
export function loadSkillsFromDirectory(dirPath: string): SkillDefinition[] {
    const skills: SkillDefinition[] = [];

    let entries: string[];
    try {
        entries = readdirSync(dirPath);
    } catch {
        console.warn(`Could not read skills directory: ${dirPath}`);
        return skills;
    }

    for (const entry of entries) {
        const entryPath = join(dirPath, entry);

        try {
            const stat = statSync(entryPath);
            if (!stat.isDirectory()) continue;

            // Look for SKILL.md or SKILL.jst
            const mdPath = join(entryPath, "SKILL.md");
            const jstPath = join(entryPath, "SKILL.jst");

            let content: string | undefined;
            let contentType: SkillContentType = 'md';

            if (existsSync(mdPath)) {
                content = readFileSync(mdPath, "utf-8");
                contentType = 'md';
            } else if (existsSync(jstPath)) {
                content = readFileSync(jstPath, "utf-8");
                contentType = 'jst';
            }

            if (content) {
                skills.push(parseSkillFile(content, contentType));
            }
        } catch (err) {
            console.warn(`Error loading skill from ${entryPath}:`, err);
        }
    }

    return skills;
}
