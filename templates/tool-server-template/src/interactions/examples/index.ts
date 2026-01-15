import { InteractionCollection } from "@vertesia/tools-sdk";
import textSummarizer from "./text_summarizer/index.js";
import icon from "./icon.svg.js";

export const ExampleInteractions = new InteractionCollection({
    name: "examples",
    title: "Example Interactions",
    description: "A collection of interaction examples",
    icon,
    interactions: [textSummarizer]
});
