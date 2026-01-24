/**
 * Fusion Fragment Skill Definition
 * Teaches the model how to use fusion-fragment templates
 */

import type { SkillDefinition } from '@vertesia/tools-sdk';

export const FusionFragmentSkill: SkillDefinition = {
  name: 'fusion-fragment',
  title: 'Fusion Fragment',
  description: 'Generate dynamic UI templates to display structured data as formatted cards and tables',
  content_type: 'md',
  related_tools: ['validate_fusion_fragment'],
  instructions: `# Fusion Fragment - Dynamic UI Templates

You can generate structured UI templates using \`fusion-fragment\` code blocks. The system will render these as formatted cards with the actual data values.

## How It Works

1. You generate a **template** (structure only - labels, keys, formats)
2. The system fills in **actual values** from the data
3. Use \`validate_fusion_fragment\` tool first to check your template

## Template Structure

\`\`\`json
{
  "title": "Optional title",
  "sections": [
    {
      "title": "Section Name",
      "layout": "grid-3",  // grid-2, grid-3, grid-4, list, or table
      "fields": [
        { "label": "Display Label", "key": "dataKey", "format": "text" }
      ]
    }
  ],
  "footer": "Optional footer text"
}
\`\`\`

## Field Formats

| Format | Description | Example |
|--------|-------------|---------|
| \`text\` | Plain text (default) | "Acme Corp" |
| \`number\` | Formatted number | "1,234,567" |
| \`currency\` | Money with symbol | "$1,000,000" |
| \`percent\` | Percentage | "25.5%" |
| \`date\` | Formatted date | "Jan 15, 2024" |
| \`boolean\` | Yes/No | "Yes" |

## Field Options

\`\`\`json
{
  "label": "IRR Target",
  "key": "irrTarget",
  "format": "percent",
  "decimals": 1,
  "unit": "p.a.",
  "highlight": "success",
  "tooltip": "Internal Rate of Return target"
}
\`\`\`

- \`decimals\`: Number of decimal places (for number/currency/percent)
- \`currency\`: Currency code like "USD", "EUR" (for currency format)
- \`unit\`: Text shown after value (e.g., "years", "USD")
- \`highlight\`: Color the value - "success" (green), "warning" (yellow), "error" (red), "info" (blue)
- \`tooltip\`: Hover text
- \`editable\`: Allow user to edit (future)

## Table Layout

For tabular data, use \`layout: "table"\` with \`columns\` and \`dataKey\`:

\`\`\`json
{
  "sections": [{
    "title": "Transactions",
    "layout": "table",
    "columns": [
      { "header": "Date", "key": "date", "format": "date" },
      { "header": "Type", "key": "type" },
      { "header": "Amount", "key": "amount", "format": "currency" }
    ],
    "dataKey": "transactions"
  }]
}
\`\`\`

The \`dataKey\` points to an array in the data.

## Chart Layout

For visualizations, use \`layout: "chart"\` with a Vega-Lite specification:

\`\`\`json
{
  "sections": [{
    "title": "Performance Over Time",
    "layout": "chart",
    "chart": {
      "title": "NAV Trend",
      "description": "Monthly NAV values",
      "height": 300,
      "dataKey": "navHistory",
      "spec": {
        "mark": "line",
        "encoding": {
          "x": { "field": "date", "type": "temporal", "title": "Date" },
          "y": { "field": "nav", "type": "quantitative", "title": "NAV" }
        }
      }
    }
  }]
}
\`\`\`

### Chart Options

- \`title\`: Chart title (displayed above)
- \`description\`: Optional subtitle
- \`height\`: Chart height in pixels (default: 280)
- \`dataKey\`: Key pointing to array of data points
- \`spec\`: Vega-Lite specification

### Vega-Lite Mark Types

| Mark | Use Case |
|------|----------|
| \`bar\` | Category comparisons |
| \`line\` | Trends over time |
| \`point\` | Scatter plots |
| \`area\` | Cumulative values |
| \`rect\` | Heatmaps |
| \`arc\` | Pie/donut charts |

### Chart Examples

**Bar Chart:**
\`\`\`json
{
  "spec": {
    "mark": "bar",
    "encoding": {
      "x": { "field": "category", "type": "nominal" },
      "y": { "field": "value", "type": "quantitative" }
    }
  }
}
\`\`\`

**Line Chart with Color:**
\`\`\`json
{
  "spec": {
    "mark": "line",
    "encoding": {
      "x": { "field": "date", "type": "temporal" },
      "y": { "field": "value", "type": "quantitative" },
      "color": { "field": "series", "type": "nominal" }
    }
  }
}
\`\`\`

**Pie Chart:**
\`\`\`json
{
  "spec": {
    "mark": { "type": "arc", "innerRadius": 50 },
    "encoding": {
      "theta": { "field": "value", "type": "quantitative" },
      "color": { "field": "category", "type": "nominal" }
    }
  }
}
\`\`\`

## Validation

**Always validate your template first** using the \`validate_fusion_fragment\` tool:

\`\`\`json
{
  "template": { /* your template */ },
  "dataKeys": ["firmName", "fundName", "vintageYear", "transactions"],
  "preview": "text"
}
\`\`\`

The tool will:
- Check for errors (missing keys, invalid formats)
- Suggest corrections for typos
- Show a preview of the structure

## Complete Example

For a fund with these data keys: \`firmName\`, \`fundName\`, \`vintageYear\`, \`targetSize\`, \`irr\`, \`tvpi\`, \`transactions\`, \`navHistory\`

\`\`\`fusion-fragment
{
  "title": "Fund Overview",
  "entityType": "fund",
  "sections": [
    {
      "title": "Identity",
      "layout": "grid-3",
      "fields": [
        { "label": "Firm", "key": "firmName" },
        { "label": "Fund", "key": "fundName" },
        { "label": "Vintage", "key": "vintageYear", "format": "number" }
      ]
    },
    {
      "title": "Performance",
      "layout": "grid-2",
      "fields": [
        { "label": "Target Size", "key": "targetSize", "format": "currency" },
        { "label": "IRR", "key": "irr", "format": "percent", "highlight": "success" },
        { "label": "TVPI", "key": "tvpi", "format": "number", "decimals": 2 }
      ]
    },
    {
      "title": "NAV Trend",
      "layout": "chart",
      "chart": {
        "title": "NAV Over Time",
        "height": 250,
        "dataKey": "navHistory",
        "spec": {
          "mark": "line",
          "encoding": {
            "x": { "field": "date", "type": "temporal" },
            "y": { "field": "nav", "type": "quantitative" }
          }
        }
      }
    },
    {
      "title": "Recent Activity",
      "layout": "table",
      "columns": [
        { "header": "Date", "key": "date", "format": "date" },
        { "header": "Type", "key": "type" },
        { "header": "Amount", "key": "amount", "format": "currency" }
      ],
      "dataKey": "transactions"
    }
  ]
}
\`\`\`

## Tips

1. **Validate first** - Use \`validate_fusion_fragment\` before outputting the code block
2. **Match keys exactly** - Keys are case-sensitive and must exist in the data
3. **Choose appropriate formats** - Numbers look better with \`number\`/\`currency\`/\`percent\`
4. **Use highlights sparingly** - For KPIs or status indicators
5. **Keep sections focused** - Group related fields together
6. **Tables for lists** - Use table layout for arrays of similar items
7. **Charts for trends** - Use chart layout to visualize time series or comparisons
`
};
