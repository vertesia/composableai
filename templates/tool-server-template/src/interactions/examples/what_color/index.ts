import { PromptRole } from "@llumiverse/common";
import { InteractionSpec, TemplateType } from "@vertesia/common";
import PROMPT_CONTENT from "./prompt.hbs?raw";
import result_schema from "./result_schema";
import prompt_schema from "./prompt_schema";

export default {
    name: "what_color",
    title: "What Color",
    description: "Identifies the color of a specified object.",
    result_schema,
    prompts: [{
        role: PromptRole.user,
        content: PROMPT_CONTENT,
        content_type: TemplateType.handlebars,
        schema: prompt_schema
    }],
    tags: ["text", "summarization", "nlp", "content"]
} satisfies InteractionSpec;
