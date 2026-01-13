/**
 * TypeScript declarations for special import types
 */

// Skill imports - markdown files with ?skill suffix
declare module '*.md?skill' {
  import type { SkillDefinition } from '@vertesia/build-tools';
  const skill: SkillDefinition;
  export default skill;
}

// Skill imports - markdown files with ?skill suffix
declare module '*/SKILL.md' {
  import type { SkillDefinition } from '@vertesia/build-tools';
  const skill: SkillDefinition;
  export default skill;
}

// Skill collection imports - any file with ?skills suffix
declare module '*?skills' {
  import type { SkillDefinition } from '@vertesia/build-tools';
  const skills: SkillDefinition[];
  export default skills;
}

// Raw imports - any file with ?raw suffix
declare module '*?raw' {
  const content: string;
  export default content;
}
