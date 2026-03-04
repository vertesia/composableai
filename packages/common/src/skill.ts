/**
 * Skill types for interaction-based skills.
 *
 * Skills are interactions with `agent_runner_options.is_skill = true`.
 * They provide contextual instructions to agents without executing code.
 * When a skill is called, its rendered prompt is returned as instructions.
 *
 * Skills can have associated scripts stored at:
 *   skills/{skill_name}/*.py, *.js, etc.
 * These are automatically synced to the sandbox when the skill is used.
 */


/**
 * Context provided when searching for relevant skills
 */
export interface SkillContext {
    /**
     * The task description or user prompt
     */
    task_description?: string;

    /**
     * Tools currently being used or available
     */
    tool_names?: string[];

    /**
     * Sample of input data for pattern matching
     */
    data_sample?: string;

    /**
     * Additional keywords to consider
     */
    keywords?: string[];
}

/**
 * Payload for finding relevant skills
 */
export interface FindRelevantSkillsPayload {
    context: SkillContext;
    limit?: number;
}

/**
 * Result from skill injection into agent context.
 * Contains the rendered prompt/instructions from a skill interaction.
 */
export interface InjectedSkill {
    /**
     * The skill/interaction name
     */
    name: string;

    /**
     * The skill's rendered instructions (from the interaction prompt)
     */
    instructions: string;

    /**
     * Tools related to this skill
     */
    related_tools?: string[];

    /**
     * UI module for rendering results
     */
    ui_module?: string;

    /**
     * Match score (0-1) indicating relevance
     */
    match_score?: number;
}

/**
 * Result from generateTools activity with skills
 */
export interface ToolsWithSkills {
    /**
     * Array of tool definitions
     */
    tools: unknown[]; // ToolDefinition[]

    /**
     * Skills injected based on context
     */
    injected_skills: InjectedSkill[];
}
