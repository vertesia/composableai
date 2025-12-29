import { SkillCollection, loadSkillsFromDirectory } from "@vertesia/tools-sdk";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ExampleSkills = new SkillCollection({
    name: "examples",
    title: "Example Skills",
    description: "Example skills demonstrating various functionalities",
    skills: loadSkillsFromDirectory(__dirname)
});
