import { SkillCollection, loadSkillsFromDirectory } from "@vertesia/tools-sdk";
import PollGeneratorSkill from "./poll-generator/index.js";
import CodeReviewSkill from "./code-review/index.js";

export default new SkillCollection({
    name: "examples",
    title: "Example Skills",
    description: "A suite of simple skills demonstrating various functionalities",
    skills: [
        CodeReviewSkill,
        PollGeneratorSkill
    ]
});
