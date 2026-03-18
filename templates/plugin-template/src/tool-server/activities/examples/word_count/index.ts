import { ActivityDefinition } from "@vertesia/tools-sdk";
import { wordCount, WordCountParams } from "./word_count.js";

export const WordCountActivity = {
    name: "word_count",
    title: "Word Count",
    description: "Counts words and characters in a text string. Use this activity in DSL workflows to analyze text length.",
    input_schema: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "The text to count words and characters in",
            },
        },
        required: ["text"],
    },
    output_schema: {
        type: "object",
        properties: {
            word_count: { type: "number", description: "Number of words" },
            character_count: { type: "number", description: "Number of characters" },
        },
    },
    run: wordCount,
} satisfies ActivityDefinition<WordCountParams>;
