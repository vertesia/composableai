import { ToolDefinition } from "@llumiverse/common";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type {
    CollectionProperties,
    ICollection,
    SkillDefinition,
    SkillExecutionResult,
    ToolCollectionDefinition,
    ToolExecutionPayload,
    ToolExecutionResult
} from "./types.js";
import { kebabCaseToTitle } from "./utils.js";


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
     */
    getToolDefinitions(): ToolDefinition[] {
        const defaultSchema: ToolDefinition['input_schema'] = {
            type: 'object',
            properties: {
                context: {
                    type: "string",
                    description: "Additional context or specific requirements for this task"
                }
            }
        };

        return Array.from(this.skills.values()).map(skill => ({
            name: `skill_${skill.name}`,
            description: `[Skill] ${skill.description}. Returns contextual instructions for this task.`,
            input_schema: skill.input_schema || defaultSchema
        }));
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
     */
    async execute(ctx: Context): Promise<Response> {
        let payload: ToolExecutionPayload<Record<string, any>> | undefined;
        try {
            payload = await ctx.req.json() as ToolExecutionPayload<Record<string, any>>;
            const toolName = payload.tool_use.tool_name;

            // Extract skill name from tool name (remove "skill_" prefix if present)
            const skillName = toolName.startsWith('skill_')
                ? toolName.slice(6)
                : toolName;

            const skill = this.skills.get(skillName);

            if (!skill) {
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
            return ctx.json({
                tool_use_id: payload?.tool_use?.id || "unknown",
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

