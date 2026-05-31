import { SkillCollection } from '@vertesia/tools-sdk';
import skillDefs from './all?skills';

export const ExampleSkills = new SkillCollection({
    name: 'examples',
    title: 'Example Skills',
    description: 'Example skills demonstrating various functionalities',
    skills: skillDefs,
});

// config.ts imports `skills` from here; minimal scaffold exports `[]`.
export const skills = [ExampleSkills];
