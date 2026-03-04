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

// Template imports - markdown files named TEMPLATE.md
declare module '*/TEMPLATE.md' {
  import type { RenderingTemplateDefinition } from '@vertesia/build-tools';
  const template: RenderingTemplateDefinition;
  export default template;
}

// Template imports - markdown files with ?template suffix
declare module '*.md?template' {
  import type { RenderingTemplateDefinition } from '@vertesia/build-tools';
  const template: RenderingTemplateDefinition;
  export default template;
}

// Template collection imports - any file with ?templates suffix
declare module '*?templates' {
  import type { RenderingTemplateDefinition } from '@vertesia/build-tools';
  const templates: RenderingTemplateDefinition[];
  export default templates;
}

// Raw imports - any file with ?raw suffix
declare module '*?raw' {
  const content: string;
  export default content;
}

// Prompt imports - template files with ?prompt suffix
declare module '*?prompt' {
  import type { PromptDefinition } from '@vertesia/build-tools';
  const prompt: PromptDefinition;
  export default prompt;
}
