import { PromptRole } from "@llumiverse/common";
import type { InteractionSpec } from "@vertesia/common";
import { TemplateType } from "@vertesia/common";

export default {
    name: "assistant",
    title: "Plugin Assistant",
    description: "A conversational assistant for the plugin.",
    tags: ["assistant", "chat"],
    agent_runner_options: {
        is_agent: true,
    },
    prompts: [
        {
            role: PromptRole.system,
            content: "You are a helpful assistant for this plugin. Answer questions and help users with their tasks.",
            content_type: TemplateType.text,
        },
        {
            role: PromptRole.user,
            content_type: TemplateType.handlebars,
            content: "{{user_prompt}}",
        },
    ],
} satisfies InteractionSpec;
