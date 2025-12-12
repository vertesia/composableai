import { PromptRole } from "@llumiverse/common";
import { InteractionSpec, TemplateType } from "@vertesia/common";
import PROMPT_CONTENT from "./prompt.jst?raw";

export default {
    name: "text_summarizer",
    title: "Text Summarizer",
    description: "Summarizes text according to specified parameters like style, length, and format.",
    result_schema: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "The generated summary"
            },
            word_count: {
                type: "number",
                description: "Number of words in the summary"
            }
        },
        required: ["summary"]
    },
    prompts: [{
        role: PromptRole.user,
        content: PROMPT_CONTENT,
        content_type: TemplateType.jst,
        schema: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The text to summarize"
                },
                style: {
                    type: "string",
                    enum: ["concise", "detailed", "bullet-points", "executive"],
                    description: "The summary style"
                },
                maxLength: {
                    type: "number",
                    description: "Maximum length in words (optional)"
                },
                format: {
                    type: "string",
                    enum: ["paragraph", "bullet-points", "structured"],
                    description: "Output format (optional)"
                }
            },
            required: ["text"]
        }
    }],
    tags: ["text", "summarization", "nlp", "content"]
} satisfies InteractionSpec;
