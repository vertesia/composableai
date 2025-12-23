import { SkillDefinition } from "@vertesia/tools-sdk";
import skillPrompt from "./SKILL.md?raw";

export default {
    name: "code-review",
    title: "Code Review Assistant",
    description: "Analyze code and provide constructive feedback on quality, best practices, and performance",
    instructions: skillPrompt,
    content_type: "md",
    context_triggers: {
        keywords: [
            "code",
            "review",
            "quality",
            "best-practices",
            "refactoring"
        ]
    }
} satisfies SkillDefinition;