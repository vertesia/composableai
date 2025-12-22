import { SkillCollection, loadSkillsFromDirectory } from "@vertesia/tools-sdk";

export const ExampleSkills = new SkillCollection({
    name: "examples",
    title: "Example Skills",
    description: "A suite of simple skills demonstrating various functionalities",
    skills: loadSkillsFromDirectory(new URL("./examples", import.meta.url).pathname)
});

export const skills = [
    ExampleSkills
];
