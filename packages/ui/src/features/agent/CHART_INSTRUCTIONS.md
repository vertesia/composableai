# Chart Creation Instructions for AI Agents

This document provides instructions for AI agents on how to create interactive charts that will be rendered in the UI.

## Overview

You can create charts by including a special markdown code block with the language `chart`. The UI will automatically detect and render these as interactive Recharts visualizations.

## Basic Format

```markdown
\`\`\`chart
{
  "version": "1.0",
  "library": "recharts",
  "chart": "bar" | "line" | "composed",
  "title": "Chart Title",
  "description": "Optional description",
  "data": [ /* array of data objects */ ],
  "xKey": "fieldName",
  "series": [ /* array of series configurations */ ],
  "yAxis": { /* optional axis labels */ },
  "options": { /* optional chart options */ }
}
\`\`\`
```

## Chart Types

### 1. Bar Chart
Used for comparing values across categories.

```chart
{
  "version": "1.0",
  "chart": "bar",
  "title": "Revenue by Quarter",
  "data": [
    { "quarter": "Q1", "revenue": 100000 },
    { "quarter": "Q2", "revenue": 150000 },
    { "quarter": "Q3", "revenue": 120000 }
  ],
  "xKey": "quarter",
  "series": [
    { "key": "revenue", "label": "Revenue", "type": "bar" }
  ]
}
```

### 2. Line Chart
Used for showing trends over time.

```chart
{
  "version": "1.0",
  "chart": "line",
  "title": "Performance Over Time",
  "data": [
    { "period": "2024-Q1", "tvpi": 1.2, "dpi": 0.3 },
    { "period": "2024-Q2", "tvpi": 1.5, "dpi": 0.5 },
    { "period": "2024-Q3", "tvpi": 1.8, "dpi": 0.7 }
  ],
  "xKey": "period",
  "series": [
    { "key": "tvpi", "label": "TVPI", "color": "#4f46e5", "dot": false },
    { "key": "dpi", "label": "DPI", "color": "#16a34a", "dot": false }
  ],
  "yAxis": {
    "left": { "label": "Multiple (x)" }
  }
}
```

### 3. Composed Chart
Used for mixing bar and line charts (e.g., bars for cashflows, line for net).

```chart
{
  "version": "1.0",
  "chart": "composed",
  "title": "Cashflow Timeline",
  "data": [
    { "period": "2024-Q1", "calls": 1000000, "distributions": 500000, "netCashflow": -500000 },
    { "period": "2024-Q2", "calls": 800000, "distributions": 1200000, "netCashflow": 400000 }
  ],
  "xKey": "period",
  "series": [
    { "key": "calls", "label": "Calls", "type": "bar", "color": "#ef4444" },
    { "key": "distributions", "label": "Distributions", "type": "bar", "color": "#22c55e" },
    { "key": "netCashflow", "label": "Net CF", "type": "line", "color": "#0ea5e9", "yAxisId": "right", "dot": false }
  ],
  "yAxis": {
    "left": { "label": "Amount" },
    "right": { "label": "Net" }
  },
  "options": {
    "referenceZero": true
  }
}
```

## Series Configuration

Each series can have:

- `key`: (required) The field name in the data
- `label`: Display name for the legend
- `type`: "bar" or "line" (for composed charts)
- `color`: Hex color code (e.g., "#4f46e5")
- `yAxisId`: "left" (default) or "right" for dual Y-axis
- `stackId`: Group bars for stacking
- `dot`: true/false - show dots on line charts

## Options

- `stacked`: true/false - Stack bars in bar charts
- `referenceZero`: true/false - Show a reference line at y=0
- `collapsible`: true/false - Allow users to collapse the chart (default: true)
- `collapseInitially`: true/false - Start in collapsed state

## Number Formatting

Numbers are automatically formatted:
- 1,000 → 1K
- 1,000,000 → 1M
- 1,000,000,000 → 1B

## Pre-built Chart Builders (TypeScript)

If you're writing TypeScript code, you can use these helper functions:

```typescript
import {
  buildCashflowComposedChart,
  buildPerformanceLineChart,
  buildScenarioComparisonBarChart,
  toChartMarkdown
} from '@vertesia/ui/features';

// Example: Create a cashflow chart
const chart = buildCashflowComposedChart({
  title: 'Fund Cashflow',
  rows: [
    { period: '2024-Q1', calls: 1000000, distributions: 500000 },
    { period: '2024-Q2', calls: 800000, distributions: 1200000 }
  ]
});

// Convert to markdown
const markdown = toChartMarkdown(chart);
```

### Available Builders

1. `buildCashflowComposedChart` - Calls/Distributions + Net CF
2. `buildPerformanceLineChart` - TVPI/DPI/RVPI J-curve
3. `buildScenarioComparisonBarChart` - Side-by-side comparison
4. `buildScenarioDeltaPercentChart` - % change visualization
5. `buildTvpiOverlayChart` - TVPI comparison between scenarios
6. `buildNavLineChart` - NAV over time

## Best Practices

1. **Use appropriate chart types**:
   - Bar charts for comparisons
   - Line charts for trends
   - Composed charts for mixed metrics

2. **Keep data concise**:
   - Limit to 20-30 data points for readability
   - Use aggregation for large datasets

3. **Color consistency**:
   - Use the default color palette for consistency
   - Red (#ef4444) for negative/costs
   - Green (#22c55e) for positive/gains
   - Blue (#0ea5e9) for neutral metrics

4. **Add context**:
   - Always include a descriptive title
   - Add a description when the chart needs explanation
   - Use axis labels for clarity

5. **Dual Y-axis**:
   - Use when comparing metrics with different scales
   - Example: Amount (left) vs Count (right)

## Example: Complete Workflow

When a user asks "Show me the fund performance":

1. Fetch or calculate the data
2. Format it as a chart spec
3. Include it in your response:

```markdown
Here's the fund performance over time:

\`\`\`chart
{
  "version": "1.0",
  "chart": "line",
  "title": "Fund Performance",
  "data": [
    { "period": "2024-Q1", "tvpi": 1.2 },
    { "period": "2024-Q2", "tvpi": 1.5 }
  ],
  "xKey": "period",
  "series": [
    { "key": "tvpi", "label": "TVPI", "color": "#4f46e5" }
  ]
}
\`\`\`

The fund shows strong performance with TVPI increasing from 1.2x to 1.5x.
```

## Common Pitfalls

❌ **Don't** include line breaks in the JSON
❌ **Don't** use single quotes in JSON (use double quotes)
❌ **Don't** forget to specify the chart type
❌ **Don't** mix up xKey with data field names

✅ **Do** validate your JSON before including it
✅ **Do** include descriptive labels
✅ **Do** test with sample data first
✅ **Do** provide context around the chart
