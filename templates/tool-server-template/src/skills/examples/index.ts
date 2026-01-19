import { SkillCollection } from "@vertesia/tools-sdk";

import CodeReviewSkill from "./code-review/SKILL.md";
import UserSelectSkill from "./user-select/SKILL.md";

export const ExampleSkills = new SkillCollection({
    name: "examples",
    title: "Example Skills",
    description: "Example skills demonstrating various functionalities",
    skills: [
        UserSelectSkill,
        CodeReviewSkill
    ]
});
