# AgentChart Test Examples

## Test Message with Bar Chart

```chart
{
  "version": "1.0",
  "library": "simple",
  "chart": "bar",
  "title": "Quarterly Revenue",
  "description": "Revenue breakdown by quarter",
  "data": [
    {"quarter": "Q1", "revenue": 45000, "expenses": 30000},
    {"quarter": "Q2", "revenue": 52000, "expenses": 35000},
    {"quarter": "Q3", "revenue": 48000, "expenses": 32000},
    {"quarter": "Q4", "revenue": 61000, "expenses": 40000}
  ],
  "xKey": "quarter",
  "series": [
    {
      "key": "revenue",
      "label": "Revenue",
      "color": "#22c55e"
    },
    {
      "key": "expenses",
      "label": "Expenses",
      "color": "#ef4444"
    }
  ],
  "options": {
    "referenceZero": true,
    "collapsible": true
  }
}
```

## Test Message with Line Chart

```chart
{
  "version": "1.0",
  "chart": "line",
  "title": "Portfolio Growth",
  "description": "NAV progression over time",
  "data": [
    {"month": "Jan", "nav": 100, "target": 105},
    {"month": "Feb", "nav": 110, "target": 110},
    {"month": "Mar", "nav": 115, "target": 115},
    {"month": "Apr", "nav": 125, "target": 120},
    {"month": "May", "nav": 130, "target": 125},
    {"month": "Jun", "nav": 145, "target": 130}
  ],
  "xKey": "month",
  "series": [
    {
      "key": "nav",
      "label": "Actual NAV",
      "color": "#4f46e5",
      "dot": true
    },
    {
      "key": "target",
      "label": "Target NAV",
      "color": "#06b6d4",
      "dot": false
    }
  ],
  "options": {
    "collapsible": false
  }
}
```

## How to Test

1. Send a message with one of the chart markdown blocks above
2. The agent should render an interactive chart
3. Verify:
   - Chart displays correctly
   - Legend shows series labels
   - Tooltips work on hover (for simple charts, titles on elements)
   - Collapse/expand button works (if collapsible is true)
   - Grid lines and axis labels render properly

## Chart Spec Format

The chart spec is a JSON object with the following structure:

```typescript
{
  version?: '1.0';
  library?: 'simple' | 'recharts';
  chart: 'bar' | 'line' | 'composed';  // Chart type
  title?: string;                       // Chart title
  description?: string;                 // Chart description
  data: Array<Record<string, any>>;    // Data points
  xKey: string;                        // Key for X-axis values
  series: Array<{                      // Data series to plot
    key: string;                       // Data key
    label?: string;                    // Display label
    type?: 'bar' | 'line';            // Series type (for composed charts)
    color?: string;                    // Series color
    dot?: boolean;                     // Show dots on line charts
  }>;
  options?: {
    stacked?: boolean;                 // Stack bars
    referenceZero?: boolean;           // Show zero reference line
    collapsible?: boolean;             // Allow hiding chart
    collapseInitially?: boolean;       // Start collapsed
  };
}
```
