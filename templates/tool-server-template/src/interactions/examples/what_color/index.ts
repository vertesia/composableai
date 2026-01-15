import { InteractionSpec } from "@vertesia/common";
import PROMPT from "./prompt.hbs?prompt";
import result_schema from "./result_schema";

export default {
    name: "what_color",
    title: "What Color",
    description: "Identifies the color of a specified object.",
    result_schema,
    prompts: [PROMPT],
    tags: ["text", "summarization", "nlp", "content"]
} satisfies InteractionSpec;
