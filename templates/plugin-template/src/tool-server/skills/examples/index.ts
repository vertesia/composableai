import { SkillCollection } from "@vertesia/tools-sdk";
import skills from "./all?skills";

export const ExampleSkills = new SkillCollection({
    name: "examples",
    title: "Example Skills",
    description: "Example skills demonstrating various functionalities",
    skills
});
