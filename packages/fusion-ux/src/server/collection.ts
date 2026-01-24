/**
 * Tool and skill collections for fusion-ux
 */

import { ToolCollection, SkillCollection } from '@vertesia/tools-sdk';
import { ValidateFusionFragmentTool } from '../tools/ValidateFusionFragmentTool.js';
import { FusionFragmentSkill } from '../skills/fusion-fragment.js';

/**
 * Fusion UX tool collection
 *
 * Provides tools for dynamic UI generation and validation.
 *
 * @example
 * ```typescript
 * import { fusionUxTools } from '@vertesia/fusion-ux/server';
 *
 * // Register with your tool server
 * server.registerCollection(fusionUxTools);
 * ```
 */
export const fusionUxTools = new ToolCollection({
  name: 'fusion-ux',
  title: 'Fusion UX',
  description: 'Dynamic UI generation and validation tools for model-generated interfaces',
  tools: [
    ValidateFusionFragmentTool,
    // Future tools can be added here
  ],
});

/**
 * Fusion UX skill collection
 *
 * Provides skills that teach models how to use fusion-fragment templates.
 *
 * @example
 * ```typescript
 * import { fusionUxSkills } from '@vertesia/fusion-ux/server';
 *
 * // Register with your skill server
 * server.registerCollection(fusionUxSkills);
 * ```
 */
export const fusionUxSkills = new SkillCollection({
  name: 'fusion-ux',
  title: 'Fusion UX',
  description: 'Skills for generating dynamic UI templates',
  skills: [
    FusionFragmentSkill,
  ],
});
