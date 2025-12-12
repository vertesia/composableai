import { SkillCollection, loadSkillsFromDirectory } from "@vertesia/tools-sdk";

export const CodeReviewSkills = new SkillCollection({
    name: "code-review",
    title: "Code Review Skills",
    description: "Skills for reviewing and analyzing code quality",
    skills: loadSkillsFromDirectory(new URL("./code-review", import.meta.url).pathname)
});

export const skills = [
    CodeReviewSkills
];
