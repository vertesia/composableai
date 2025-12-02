import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    FindRelevantSkillsPayload,
    InjectedSkill,
    SkillContext,
} from "@vertesia/common";

/**
 * API client for skill operations.
 * Skills are interactions with agent_runner_options.is_skill = true.
 * They provide contextual instructions to agents by executing/rendering
 * the interaction and returning the result.
 */
export default class SkillsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/skills");
    }

    /**
     * Find skills relevant to a given context.
     * This is the core skill matching API for auto-injection.
     * @param context The context to match against
     * @param limit Maximum number of skills to return (default: 5)
     * @returns Array of injected skills with match scores
     */
    findRelevant(context: SkillContext, limit?: number): Promise<InjectedSkill[]> {
        const payload: FindRelevantSkillsPayload = { context, limit };
        return this.post("/find-relevant", { payload });
    }

    /**
     * Convenience method to find relevant skills by task description
     * @param taskDescription The task or prompt to match
     * @param toolNames Optional list of tools being used
     * @returns Array of injected skills
     */
    findRelevantForTask(
        taskDescription: string,
        toolNames?: string[]
    ): Promise<InjectedSkill[]> {
        return this.findRelevant({
            task_description: taskDescription,
            tool_names: toolNames,
        });
    }
}
