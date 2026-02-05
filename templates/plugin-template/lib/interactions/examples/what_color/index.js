import PROMPT from './prompt.hbs.js';
import result_schema from './result_schema.js';

var whatColor = {
    name: "what_color",
    title: "What Color",
    description: "Identifies the color of a specified object.",
    result_schema,
    prompts: [PROMPT],
    tags: ["text", "summarization", "nlp", "content"]
};

export { whatColor as default };
//# sourceMappingURL=index.js.map
