# @vertesia/fusion-ux

Dynamic model-generated UI components for Vertesia. Models generate templates (structure), the system provides values (data).

## Installation

```bash
pnpm add @vertesia/fusion-ux
```

## Quick Start

### Client-side (React)

```tsx
import {
  FusionFragmentRenderer,
  FusionFragmentProvider,
  FusionFragmentHandler,
} from '@vertesia/fusion-ux';

// Option 1: Direct rendering with template and data
<FusionFragmentRenderer
  template={{
    title: "Fund Parameters",
    sections: [{
      title: "Identity",
      layout: "grid-3",
      fields: [
        { label: "Firm Name", key: "firmName" },
        { label: "Vintage", key: "vintageYear", format: "number" }
      ]
    }]
  }}
  data={{ firmName: "Acme Capital", vintageYear: 2024 }}
  onUpdate={async (key, value) => {
    // Handle field updates
  }}
/>

// Option 2: Context-based rendering (for markdown code blocks)
<FusionFragmentProvider data={fund.parameters} onUpdate={handleUpdate}>
  <MarkdownRenderer content={agentResponse} />
</FusionFragmentProvider>

// Option 3: Code block handler for markdown renderers
const codeBlockRenderers = {
  'fusion-fragment': ({ code }) => <FusionFragmentHandler code={code} />
};
```

### Server-side (Tools)

```typescript
import { fusionUxTools } from '@vertesia/fusion-ux/server';

// Register tools with your server
server.registerCollection(fusionUxTools);
```

## Template Structure

```typescript
interface FragmentTemplate {
  title?: string;
  entityType?: 'fund' | 'scenario' | 'portfolio' | 'transaction' | 'custom';
  sections: SectionTemplate[];
  footer?: string;
}

interface SectionTemplate {
  title: string;
  layout?: 'grid-2' | 'grid-3' | 'grid-4' | 'list';
  collapsed?: boolean;
  fields: FieldTemplate[];
}

interface FieldTemplate {
  label: string;           // Display label
  key: string;             // Data key (required)
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
  unit?: string;           // e.g., "years", "USD"
  editable?: boolean;
  highlight?: 'success' | 'warning' | 'error' | 'info';
  tooltip?: string;
  decimals?: number;       // For number/currency/percent
  currency?: string;       // For currency format
}
```

## Validation Tool

The `validate_fusion_fragment` tool allows models to validate templates:

```json
{
  "template": {
    "sections": [{
      "title": "Identity",
      "fields": [{ "label": "Firm", "key": "firmName" }]
    }]
  },
  "dataKeys": ["firmName", "fundName", "vintageYear"],
  "preview": "text"
}
```

Returns errors with suggestions or a text preview of the template.

## API

### Components

- `FusionFragmentRenderer` - Main renderer component
- `FusionFragmentProvider` - Context provider for data
- `FusionFragmentHandler` - Code block handler
- `SectionRenderer` - Section renderer
- `FieldRenderer` - Field renderer

### Validation

- `validateTemplate(template, dataKeys)` - Validate a template
- `parseAndValidateTemplate(jsonString, dataKeys)` - Parse and validate
- `findClosestKey(input, validKeys)` - Fuzzy key matching
- `formatValidationErrors(errors)` - Format errors for models

### Server

- `fusionUxTools` - Tool collection for registration
- `ValidateFusionFragmentTool` - The validation tool

### Serverless Rendering

Render templates to PNG without a browser using `@napi-rs/canvas`:

```typescript
import { renderToBuffer, renderToBase64, renderToDataUrl } from '@vertesia/fusion-ux/server';

// Render to PNG buffer
const buffer = renderToBuffer(template, data);
fs.writeFileSync('preview.png', buffer);

// Render to base64 string
const base64 = renderToBase64(template, data);

// Render to data URL
const dataUrl = renderToDataUrl(template, data);
// Returns: "data:image/png;base64,..."

// With custom options
const buffer = renderToBuffer(template, data, {
  width: 800,      // Canvas width (default: 600)
  padding: 24,     // Padding around content (default: 20)
  fieldHeight: 60, // Height per field row (default: 50)
});
```

## License

Apache-2.0
