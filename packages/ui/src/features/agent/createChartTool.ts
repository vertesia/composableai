/**
 * Chart creation tool definition for AI agents.
 *
 * This provides a tool schema that AI agents can use to understand
 * how to create charts in their responses.
 */

import type { AgentChartSpec } from './chat/AgentChart';

/**
 * Tool definition for creating charts.
 * Can be used with Claude, OpenAI, or other LLM tool-calling systems.
 */
export const createChartToolDefinition = {
    name: 'create_chart',
    description: `Create an interactive chart visualization that will be rendered in the UI.

IMPORTANT: You don't actually "call" this tool. Instead, you include a markdown code block with language "chart" in your response.

Charts are created using JSON specifications in markdown code blocks:

\`\`\`chart
{
  "version": "1.0",
  "chart": "bar" | "line" | "composed",
  "title": "Chart Title",
  "data": [{ "x": "value", "y": 100 }],
  "xKey": "x",
  "series": [{ "key": "y", "label": "Y Values" }]
}
\`\`\`

CHART TYPES:
- "bar" - Bar charts for comparisons
- "line" - Line charts for trends over time
- "composed" - Mixed bar and line charts

WHEN TO USE:
- User explicitly asks for a chart/graph/visualization
- You have time-series or comparative data (8+ data points)
- Visual representation would clarify the data
- Keywords: "show me", "chart", "graph", "visualize", "trend", "compare"

EXAMPLE - Bar Chart:
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

EXAMPLE - Line Chart (Performance):
\`\`\`chart
{
  "chart": "line",
  "title": "Fund Performance",
  "data": [
    {"period": "2024-Q1", "tvpi": 1.2, "dpi": 0.3},
    {"period": "2024-Q2", "tvpi": 1.5, "dpi": 0.5}
  ],
  "xKey": "period",
  "series": [
    {"key": "tvpi", "label": "TVPI", "color": "#4f46e5"},
    {"key": "dpi", "label": "DPI", "color": "#16a34a"}
  ],
  "yAxis": {"left": {"label": "Multiple (x)"}}
}
\`\`\`

EXAMPLE - Composed Chart (Cashflow):
\`\`\`chart
{
  "chart": "composed",
  "title": "Cashflow Timeline",
  "data": [
    {"period": "2024-Q1", "calls": 1000000, "distributions": 500000, "net": -500000},
    {"period": "2024-Q2", "calls": 800000, "distributions": 1200000, "net": 400000}
  ],
  "xKey": "period",
  "series": [
    {"key": "calls", "label": "Calls", "type": "bar", "color": "#ef4444"},
    {"key": "distributions", "label": "Distributions", "type": "bar", "color": "#22c55e"},
    {"key": "net", "label": "Net CF", "type": "line", "color": "#0ea5e9", "yAxisId": "right"}
  ],
  "yAxis": {"left": {"label": "Amount"}, "right": {"label": "Net"}},
  "options": {"referenceZero": true}
}
\`\`\`

SERIES CONFIGURATION:
- key: (required) Field name in data
- label: Display name in legend
- type: "bar" | "line" (for composed charts)
- color: Hex color (e.g., "#4f46e5")
- yAxisId: "left" (default) | "right"
- dot: true/false (for line charts)

COLORS:
- Red (#ef4444) - Negative/costs
- Green (#22c55e) - Positive/gains
- Blue (#4f46e5) - Primary metrics
- Cyan (#0ea5e9) - Secondary metrics
- Amber (#f59e0b) - Warnings/highlights

OPTIONS:
- referenceZero: Show line at y=0 (useful for +/- values)
- collapsible: Allow collapse (default: true)
- collapseInitially: Start collapsed (default: false)
- stacked: Stack bars (for bar charts)

BEST PRACTICES:
1. Always include a descriptive title
2. Use appropriate chart type for the data
3. Limit to 20-30 data points for readability
4. Add axis labels for clarity
5. Use consistent colors (green=positive, red=negative)
6. Add description for complex charts

Remember: Numbers are auto-formatted (1K, 1M, 1B)`,

    input_schema: {
        type: 'object',
        properties: {
            chart: {
                type: 'string',
                enum: ['bar', 'line', 'composed'],
                description: 'Type of chart to create',
            },
            title: {
                type: 'string',
                description: 'Chart title',
            },
            description: {
                type: 'string',
                description: 'Optional description shown below the title',
            },
            data: {
                type: 'array',
                description: 'Array of data objects',
                items: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            xKey: {
                type: 'string',
                description: 'Field name to use for X-axis',
            },
            series: {
                type: 'array',
                description: 'Array of series to plot',
                items: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Field name in data',
                        },
                        label: {
                            type: 'string',
                            description: 'Display name',
                        },
                        type: {
                            type: 'string',
                            enum: ['bar', 'line'],
                            description: 'Series type (for composed charts)',
                        },
                        color: {
                            type: 'string',
                            description: 'Hex color code',
                        },
                        yAxisId: {
                            type: 'string',
                            enum: ['left', 'right'],
                            description: 'Which Y-axis to use',
                        },
                        dot: {
                            type: 'boolean',
                            description: 'Show dots on line (default: false)',
                        },
                    },
                    required: ['key'],
                },
            },
            yAxis: {
                type: 'object',
                description: 'Y-axis configuration',
                properties: {
                    left: {
                        type: 'object',
                        properties: {
                            label: { type: 'string' },
                        },
                    },
                    right: {
                        type: 'object',
                        properties: {
                            label: { type: 'string' },
                        },
                    },
                },
            },
            options: {
                type: 'object',
                description: 'Chart options',
                properties: {
                    stacked: {
                        type: 'boolean',
                        description: 'Stack bars',
                    },
                    referenceZero: {
                        type: 'boolean',
                        description: 'Show reference line at y=0',
                    },
                    collapsible: {
                        type: 'boolean',
                        description: 'Allow user to collapse chart',
                    },
                    collapseInitially: {
                        type: 'boolean',
                        description: 'Start collapsed',
                    },
                },
            },
        },
        required: ['chart', 'data', 'xKey', 'series'],
    },
};

/**
 * System prompt addition for chart capabilities.
 * Include this in your agent's system prompt to enable chart creation.
 */
export const chartSystemPromptAddition = `
# Chart Visualization Capability

You can create interactive charts by including markdown code blocks with the language "chart".

Format:
\`\`\`chart
{
  "chart": "bar|line|composed",
  "title": "Chart Title",
  "data": [...],
  "xKey": "fieldName",
  "series": [{"key": "fieldName", "label": "Display Name"}]
}
\`\`\`

Use charts when:
- User explicitly requests visualization
- You have 8+ data points to display
- Visual representation clarifies the information
- Showing trends, comparisons, or time-series data

Chart types:
- bar: Comparisons across categories
- line: Trends over time
- composed: Mix of bars and lines (e.g., cashflow with net line)

Always include descriptive titles and use appropriate colors (green for positive, red for negative).
`;

/**
 * Type-safe chart specification builder.
 * Use this when you want to build charts programmatically.
 */
export function buildChartSpec(spec: AgentChartSpec): string {
    // Validate the spec
    if (!spec.chart || !spec.data || !spec.xKey || !spec.series) {
        throw new Error('Invalid chart spec: missing required fields (chart, data, xKey, series)');
    }

    if (!Array.isArray(spec.data)) {
        throw new Error('Invalid chart spec: data must be an array');
    }

    if (!Array.isArray(spec.series) || spec.series.length === 0) {
        throw new Error('Invalid chart spec: series must be a non-empty array');
    }

    // Return as markdown code block
    const json = JSON.stringify(spec, null, 2);
    return `\`\`\`chart\n${json}\n\`\`\``;
}

/**
 * Extract chart specifications from markdown text.
 * Useful for parsing agent responses.
 */
export function extractChartSpecs(markdown: string): AgentChartSpec[] {
    const chartBlockRegex = /```chart\s*\n([\s\S]*?)\n```/g;
    const specs: AgentChartSpec[] = [];

    let match;
    while ((match = chartBlockRegex.exec(markdown)) !== null) {
        try {
            const spec = JSON.parse(match[1]) as AgentChartSpec;
            specs.push(spec);
        } catch (e) {
            console.warn('Failed to parse chart spec:', e);
        }
    }

    return specs;
}
