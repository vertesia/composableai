import { InteractionCollection } from "@vertesia/tools-sdk";
import textSummarizer from "./text_summarizer/index.js";
import icon from "./icon.svg.js";

export const SummarizeInteractions = new InteractionCollection({
    name: "summarize",
    title: "Summarization Interactions",
    description: "A collection of interactions for summarizing and condensing text",
    icon,
    interactions: [textSummarizer]
});
