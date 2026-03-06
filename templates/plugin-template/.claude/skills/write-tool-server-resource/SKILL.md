---
name: write-tool-server-resource
description: Creates tools, skills, interactions, content types, and rendering templates for the Vertesia plugin tool server. Handles file scaffolding, collection registration, and config.ts wiring. Use when adding new tool server resources to this plugin.
---

# Write Tool Server Resource

Step-by-step guide for creating tool server resources. Each resource follows the same workflow:
1. Create files in the appropriate `src/tool-server/<type>/<collection>/` directory
2. Export from the collection's `index.ts`
3. Register the collection in `config.ts` (if new collection)

**Important conventions:**
- All imports use `.js` extensions: `import { x } from "./foo.js"`
- Use `satisfies` for type validation
- Icons are SVG strings exported as default from `.ts` files
- Import hooks (`?skill`, `?skills`, `?prompt`, `?template`, `?templates`) only work in Rollup-compiled code
- Snake_case for resource names (`my_tool`), PascalCase for TypeScript exports (`MyTool`)

For full code examples, see the `examples/` directories under each resource type.

---

## Creating a Tool

### File structure

```
src/tool-server/tools/<collection>/<tool-name>/
  schema.ts     # TypeScript interface + JSONSchema
  index.ts      # Tool definition (satisfies Tool<ParamsT>)
  <impl>.ts     # Implementation logic
```

### Step 1: Define the schema

```typescript
// schema.ts
import { JSONSchema } from "@llumiverse/common";

export interface MyToolParams {
    query: string;
    limit?: number;
}

export const Schema = {
    type: "object",
    properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" }
    },
    required: ["query"]
} satisfies JSONSchema;
```

### Step 2: Implement the logic

```typescript
// my-impl.ts
import { ToolExecutionContext, ToolExecutionPayload } from "@vertesia/tools-sdk";
import { ToolResultContent } from "@vertesia/common";
import { type MyToolParams } from "./schema.js";

export async function myToolRun(
    payload: ToolExecutionPayload<MyToolParams>,
    context: ToolExecutionContext
): Promise<ToolResultContent> {
    try {
        const { query, limit } = payload.tool_use.tool_input!;
        const client = await context.getClient();
        const results = await client.store.objects.find({ where: { name: query }, limit });

        return { is_error: false, content: JSON.stringify(results) };
    } catch (error) {
        return {
            is_error: true,
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
```

### Step 3: Define the tool

```typescript
// index.ts
import { Tool } from "@vertesia/tools-sdk";
import { myToolRun } from "./my-impl.js";
import { MyToolParams, Schema } from "./schema.js";

export const MyTool = {
    name: "my_tool",
    description: "Description of what this tool does",
    input_schema: Schema,
    run: myToolRun
} satisfies Tool<MyToolParams>;
```

### Step 4: Add to collection

```typescript
// src/tool-server/tools/<collection>/index.ts
import { ToolCollection } from "@vertesia/tools-sdk";
import { MyTool } from "./my-tool/index.js";
import icon from "./icon.svg.js";

export const MyTools = new ToolCollection({
    name: "my-collection",
    title: "My Tools",
    description: "Description of this collection",
    icon,
    tools: [MyTool]
});
```

### Step 5: Register in config.ts

Add the collection to the `tools` array in `src/tool-server/tools/index.ts`, which is imported by `config.ts`.

---

## Creating a Skill

### File structure

```
src/tool-server/skills/<collection>/<skill-name>/
  SKILL.md        # Skill definition (YAML frontmatter + instructions)
  properties.ts   # Optional: runtime properties (isEnabled)
  *.tsx            # Optional: widgets (compiled to dist/widgets/)
  *.py, *.js       # Optional: scripts (copied to dist/scripts/)
```

### Step 1: Write SKILL.md

```markdown
---
name: my-skill
title: My Skill
description: What this skill does and when to use it
keywords: [keyword1, keyword2, keyword3]
tools: [tool-to-enable]
---

# Skill Instructions

Instructions for the AI agent when this skill is active.

## What to do

Describe the behavior, output format, and constraints.
```

**Frontmatter fields:**
- `name` (required): Snake_case identifier
- `description` (required): What the skill does
- `title`: Display name
- `keywords`: Trigger auto-activation when matched
- `tools`: Related tools to unlock when skill is active
- `language`/`packages`: For code execution skills
- `widgets`: UI widgets to render

### Step 2 (optional): Add runtime properties

```typescript
// properties.ts
import { SkillDefinition, ToolUseContext } from "@vertesia/tools-sdk";

export default {
    isEnabled(_context: ToolUseContext) {
        // Return false to hide this skill based on context/config
        return true;
    }
} satisfies Partial<SkillDefinition>;
```

### Step 3: Collection uses auto-discovery

```typescript
// src/tool-server/skills/<collection>/index.ts
import { SkillCollection } from "@vertesia/tools-sdk";
import skills from "./all?skills";

export const MySkills = new SkillCollection({
    name: "my-collection",
    title: "My Skills",
    description: "Description of this skill collection",
    skills   // Auto-discovers all subdirs with SKILL.md
});
```

Skills are auto-discovered — no need to manually import each one.

---

## Creating an Interaction

Two approaches: **template-based** (prompt in `.hbs` file) or **code-based** (prompts inline).

### File structure (template-based)

```
src/tool-server/interactions/<collection>/<interaction-name>/
  index.ts          # InteractionSpec
  prompt.hbs        # Handlebars prompt template with YAML frontmatter
  prompt_schema.ts  # JSONSchema for template variables
  result_schema.ts  # JSONSchema for structured output
```

### Template-based interaction

**Prompt template:**
```handlebars
{{!-- prompt.hbs --}}
---
role: user
content_type: handlebars
schema: ./prompt_schema.ts
---
Analyze the following content: {{input}}
Please provide a {{format}} summary.
```

**Prompt schema:**
```typescript
// prompt_schema.ts
import { JSONSchema } from "@llumiverse/common";

export default {
    type: "object",
    properties: {
        input: { type: "string", description: "Content to analyze" },
        format: { type: "string", description: "Output format" }
    },
    required: ["input"]
} satisfies JSONSchema;
```

**Result schema:**
```typescript
// result_schema.ts
import { JSONSchema } from "@llumiverse/common";

export default {
    type: "object",
    properties: {
        summary: { type: "string", description: "The analysis summary" },
        confidence: { type: "number", description: "Confidence score 0-1" }
    },
    required: ["summary"]
} satisfies JSONSchema;
```

**Interaction spec:**
```typescript
// index.ts
import { InteractionSpec } from "@vertesia/common";
import PROMPT from "./prompt.hbs?prompt";
import result_schema from "./result_schema.js";

export default {
    name: "analyze_content",
    title: "Analyze Content",
    description: "Analyzes content and returns a structured summary",
    result_schema,
    prompts: [PROMPT],
    tags: ["analysis", "text"]
} satisfies InteractionSpec;
```

### Code-based interaction (for agents/conversations)

```typescript
// index.ts
import { PromptRole } from "@llumiverse/common";
import type { InteractionSpec } from "@vertesia/common";
import { TemplateType } from "@vertesia/common";

export default {
    name: "my_assistant",
    title: "My Assistant",
    description: "A conversational assistant",
    tags: ["assistant", "chat"],
    agent_runner_options: {
        is_agent: true,
    },
    prompts: [
        {
            role: PromptRole.system,
            content: "You are a helpful assistant. Answer questions accurately.",
            content_type: TemplateType.text,
        },
        {
            role: PromptRole.user,
            content_type: TemplateType.handlebars,
            content: "{{user_prompt}}",
        },
    ],
} satisfies InteractionSpec;
```

### Add to collection

```typescript
// src/tool-server/interactions/<collection>/index.ts
import { InteractionCollection } from "@vertesia/tools-sdk";
import analyzeContent from "./analyze_content/index.js";
import icon from "./icon.svg.js";

export const MyInteractions = new InteractionCollection({
    name: "my-collection",
    title: "My Interactions",
    description: "Description of this collection",
    icon,
    interactions: [analyzeContent]
});
```

---

## Creating a Content Type

### File structure

```
src/tool-server/types/<collection>/
  index.ts          # ContentTypesCollection
  icon.svg.ts       # Collection icon
  <type-name>.ts    # InCodeTypeSpec (one file per type)
```

### Type definition

```typescript
// my-type.ts
import { InCodeTypeSpec } from "@vertesia/common";

export const MyType = {
    name: "my_type",
    description: "Description of this content type",
    tags: ["category1", "category2"],
    object_schema: {
        type: "object",
        properties: {
            title: { type: "string", description: "Title", minLength: 1, maxLength: 200 },
            body: { type: "string", description: "Body content" },
            status: { type: "string", enum: ["draft", "published", "archived"] }
        },
        required: ["title"],
        additionalProperties: false
    },
    table_layout: [
        { field: "properties.title", name: "Title", type: "string" },
        { field: "properties.status", name: "Status", type: "string" },
        { field: "updated_at", name: "Updated", type: "date" }
    ],
    is_chunkable: true,
    strict_mode: true
} satisfies InCodeTypeSpec;
```

### Collection

```typescript
// src/tool-server/types/<collection>/index.ts
import { ContentTypesCollection } from "@vertesia/tools-sdk";
import { MyType } from "./my-type.js";
import icon from "./icon.svg.js";

export const MyTypes = new ContentTypesCollection({
    name: "my-collection",
    title: "My Content Types",
    description: "Description of this collection",
    icon,
    types: [MyType]
});
```

---

## Creating a Rendering Template

### File structure

```
src/tool-server/templates/<collection>/<template-name>/
  TEMPLATE.md       # Template definition (YAML frontmatter + instructions)
  *.svg, *.latex     # Asset files (auto-discovered, copied to dist/templates/)
```

### TEMPLATE.md

```markdown
---
title: My Report
description: A report template for generating formatted PDFs
tags: [report, pdf]
type: document
---

# Report Template

Instructions for the document generation system.

## Available Variables

- `{{title}}` - Report title
- `{{author}}` - Author name
- `{{date}}` - Report date
```

**Frontmatter fields:**
- `description` (required): What this template generates
- `type` (required): `'document'` or `'presentation'`
- `title`: Display name
- `tags`: Categorization tags

Asset files (SVG, LaTeX, PNG) in the same directory are auto-discovered and copied to `dist/templates/`.

### Collection uses auto-discovery

```typescript
// src/tool-server/templates/<collection>/index.ts
import { RenderingTemplateCollection } from "@vertesia/tools-sdk";
import templates from './all?templates';

export const MyTemplates = new RenderingTemplateCollection({
    name: "my-collection",
    title: "My Templates",
    description: "Description of this template collection",
    templates   // Auto-discovers all subdirs with TEMPLATE.md
});
```

---

## Collection Registration

All collections must be wired into the server through `config.ts`.

### Adding to an existing collection type

Add your collection to the array in `src/tool-server/<type>/index.ts`:

```typescript
// src/tool-server/tools/index.ts
import { ExampleTools } from "./examples/index.js";
import { MyTools } from "./my-collection/index.js";

export const tools = [ExampleTools, MyTools];
```

### Creating a new collection type (first of its kind)

If `src/tool-server/<type>/index.ts` doesn't have your collection yet, add it there. The `config.ts` already imports from these index files.

### Icon file

Each collection needs an SVG icon as a default string export:

```typescript
// icon.svg.ts
export default `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
</svg>`;
```

## Verification

After creating a resource:

1. Build: `pnpm build:server`
2. Start: `pnpm start`
3. Check the admin UI at `http://localhost:3000/` — your resource should appear
4. Check the API endpoint: `curl http://localhost:3000/api/tools` (or `/api/skills`, `/api/interactions`, `/api/types`, `/api/templates`)
