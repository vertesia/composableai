# Write Tool Server Resource — Code Reference

Full code examples for each resource type. SKILL.md has the workflow and decision-points; this file has the templates you copy from.

## Table of Contents

- [Tool](#tool)
- [Skill](#skill)
- [Interaction (template-based)](#interaction-template-based)
- [Interaction (code-based)](#interaction-code-based)
- [Content Type](#content-type)
- [Rendering Template](#rendering-template)
- [Collection registration & icons](#collection-registration--icons)

---

## Tool

### `schema.ts`

```typescript
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

### `<impl>.ts`

```typescript
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

### `index.ts` (tool definition)

```typescript
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

### Collection (`tools/<collection>/index.ts`)

```typescript
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

---

## Skill

### `SKILL.md`

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

- `name` (required): snake_case identifier
- `description` (required): what the skill does
- `title`: display name
- `keywords`: trigger auto-activation when matched
- `tools`: related tools to unlock when skill is active
- `language` / `packages`: for code-execution skills
- `widgets`: UI widgets to render

### Optional `properties.ts`

```typescript
import { SkillDefinition, ToolUseContext } from "@vertesia/tools-sdk";

export default {
    isEnabled(_context: ToolUseContext) {
        // Return false to hide this skill based on context/config
        return true;
    }
} satisfies Partial<SkillDefinition>;
```

### Collection auto-discovery

```typescript
// skills/<collection>/index.ts
import { SkillCollection } from "@vertesia/tools-sdk";
import skills from "./all?skills";

export const MySkills = new SkillCollection({
    name: "my-collection",
    title: "My Skills",
    description: "Description of this skill collection",
    skills   // Auto-discovers all subdirs with SKILL.md
});
```

---

## Interaction (template-based)

### `prompt.hbs`

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

### `prompt_schema.ts`

```typescript
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

### `result_schema.ts`

```typescript
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

### `index.ts` (interaction spec)

```typescript
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

---

## Interaction (code-based)

For agents and conversational interactions (no `.hbs` file):

```typescript
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

### Collection (`interactions/<collection>/index.ts`)

```typescript
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

## Content Type

### `<type-name>.ts`

```typescript
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

### Collection (`types/<collection>/index.ts`)

```typescript
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

## Rendering Template

### `TEMPLATE.md`

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

- `{{title}}` — Report title
- `{{author}}` — Author name
- `{{date}}` — Report date
```

**Frontmatter fields:**

- `description` (required): what this template generates
- `type` (required): `'document'` or `'presentation'`
- `title`: display name
- `tags`: categorization tags

Asset files (SVG, LaTeX, PNG) in the same directory are auto-discovered and copied to `dist/templates/`.

### Collection auto-discovery

```typescript
// templates/<collection>/index.ts
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

## Collection registration & icons

### Adding a collection to its type's index

```typescript
// src/tool-server/tools/index.ts
import { ExampleTools } from "./examples/index.js";
import { MyTools } from "./my-collection/index.js";

export const tools = [ExampleTools, MyTools];
```

`config.ts` already imports from these per-type index files, so no further wiring is needed once the new collection is in the array.

### `icon.svg.ts`

Each collection needs an SVG icon as a default string export:

```typescript
export default `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
</svg>`;
```
