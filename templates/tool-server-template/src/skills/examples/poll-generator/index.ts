import { SkillDefinition } from "@vertesia/tools-sdk";
import skillPrompt from "./SKILL.md?raw";

export default {
    name: "poll-generator",
    title: "Poll Generator",
    description: "Generate interactive polls and surveys for gathering user feedback",
    widgets: [
        "poll"
    ],
    instructions: skillPrompt,
    content_type: "md",
    context_triggers: {
        keywords: [
            "poll",
            "survey",
            "vote",
            "feedback",
            "questionnaire"
        ]
    }
} satisfies SkillDefinition;
