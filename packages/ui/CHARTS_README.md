# Chart Display for Agent Messages

Interactive chart rendering for AI agent messages in the composableai UI package.

## Quick Start

### 1. Install Dependencies

```bash
cd composableai/packages/ui
pnpm install
```

### 2. Build the Package

```bash
pnpm build
```

### 3. Use in Your App

Import and configure your agent to use chart capabilities:

```typescript
import { chartSystemPromptAddition, createChartToolDefinition } from '@vertesia/ui/features';

// Add to your agent's system prompt
const systemPrompt = `
You are a helpful assistant for fund analysis.

${chartSystemPromptAddition}
`;

// Or use as a tool definition
const tools = [createChartToolDefinition];
```

## How It Works

### For AI Agents (Text Response)

The AI agent includes chart specifications in markdown code blocks:

```markdown
Here's your data:

\`\`\`chart
{
  "chart": "bar",
  "title": "Revenue by Quarter",
  "data": [
    {"quarter": "Q1", "revenue": 100000},
    {"quarter": "Q2", "revenue": 150000}
  ],
  "xKey": "quarter",
  "series": [{"key": "revenue", "label": "Revenue"}]
}
\`\`\`
```

The UI automatically detects these blocks and renders them as interactive Recharts visualizations.

### For Developers (Programmatic)

Use the pre-built chart builders:

```typescript
import { buildPerformanceLineChart, toChartMarkdown } from '@vertesia/ui/features';

const chart = buildPerformanceLineChart({
  title: 'Fund Performance',
  rows: [
    { period: '2024-Q1', tvpi: 1.2, dpi: 0.3, rvpi: 0.9 },
    { period: '2024-Q2', tvpi: 1.5, dpi: 0.5, rvpi: 1.0 }
  ]
});

const markdown = toChartMarkdown(chart);
// Returns: ```chart\n{...}\n```
```

## Chart Types

### Bar Chart
```typescript
{
  "chart": "bar",
  "title": "Comparison",
  "data": [...],
  "xKey": "category",
  "series": [{"key": "value", "label": "Value"}]
}
```

### Line Chart
```typescript
{
  "chart": "line",
  "title": "Trend Over Time",
  "data": [...],
  "xKey": "period",
  "series": [
    {"key": "metric1", "label": "Metric 1"},
    {"key": "metric2", "label": "Metric 2"}
  ]
}
```

### Composed Chart (Bar + Line)
```typescript
{
  "chart": "composed",
  "title": "Mixed Metrics",
  "data": [...],
  "xKey": "period",
  "series": [
    {"key": "bars", "type": "bar"},
    {"key": "line", "type": "line", "yAxisId": "right"}
  ],
  "yAxis": {
    "left": {"label": "Amount"},
    "right": {"label": "Rate"}
  }
}
```

## Pre-built Builders

| Function | Purpose |
|----------|---------|
| `buildCashflowComposedChart` | Calls/Distributions + Net CF |
| `buildPerformanceLineChart` | TVPI/DPI/RVPI metrics |
| `buildScenarioComparisonBarChart` | Side-by-side comparison |
| `buildScenarioDeltaPercentChart` | % change visualization |
| `buildNavLineChart` | NAV over time |
| `toChartMarkdown` | Wrap spec in code fence |

## Examples

See `src/features/agent/examples.ts` for:
- Complete markdown examples
- TypeScript builder usage
- Agent response templates
- Test data generators

## Documentation

| File | Purpose |
|------|---------|
| `CHART_INSTRUCTIONS.md` | Complete guide for AI agents |
| `CHART_PORTING_SUMMARY.md` | Implementation details |
| `examples.ts` | Code examples |
| This file | Quick start guide |

## Features

- ✅ **Three chart types:** Bar, Line, Composed
- ✅ **Dual Y-axis support** for comparing different scales
- ✅ **Number formatting** (K/M/B for large numbers)
- ✅ **Collapsible charts** for better UX
- ✅ **Dark mode support** via Tailwind
- ✅ **Responsive design** adjusts to container
- ✅ **Type-safe** with full TypeScript support

## Integration Points

### 1. System Prompt (Recommended)

```typescript
import { chartSystemPromptAddition } from '@vertesia/ui/features';

const prompt = `${basePrompt}\n\n${chartSystemPromptAddition}`;
```

### 2. Tool Definition

```typescript
import { createChartToolDefinition } from '@vertesia/ui/features';

const tools = [
  createChartToolDefinition,
  // other tools...
];
```

### 3. Message Rendering

Charts are automatically detected and rendered when messages are displayed through the `MessageItem` component.

## Testing

```typescript
import { generatePerformanceChart } from '@vertesia/ui/features';

const testMessage = {
  type: AgentMessageType.ANSWER,
  message: `
    Test chart:
    ${generatePerformanceChart()}
  `,
  timestamp: Date.now()
};
```

## Troubleshooting

### Chart not rendering?
- Check if JSON is valid (use JSONLint)
- Verify code fence uses ````chart` language
- Ensure required fields are present: `chart`, `data`, `xKey`, `series`

### Dark mode not working?
- Verify Tailwind dark mode is configured
- Check if `dark:` classes are properly set up

### Numbers not formatting?
- Number formatting is automatic
- Works for values >= 1,000

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Recharts requires client-side rendering (no SSR)

## Performance

- Recharts adds ~200KB to bundle (minified)
- Lazy load if needed for better initial load
- Limit data points to 50-100 for best performance

## License

Same as parent project (Apache-2.0)
