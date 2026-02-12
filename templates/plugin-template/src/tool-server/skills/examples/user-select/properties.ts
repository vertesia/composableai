/**
 * You can use this file to define skill properties outside of the frontmatter
 * A typical case is to define an isEnabled function that determines whether the skill should be available based on the context
 * 
 * The file must have a default export of a partial SkillDefinition 
 */

import { SkillDefinition, ToolUseContext } from "@vertesia/tools-sdk";

export default {

    isEnabled(_context: ToolUseContext) {
        return true;
    }

} satisfies Partial<SkillDefinition>;

