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
  "chart": "bar|line|area|composed|pie|scatter|radar|radialBar|funnel|treemap",
  "title": "Chart Title",
  "data": [...],
  ...
}
\`\`\`

## CHART TYPES & WHEN TO USE

| Type | Use Case | Data Shape |
|------|----------|------------|
| bar | Category comparisons | \`[{x, y1, y2}]\` |
| line | Trends over time | \`[{x, y1, y2}]\` |
| area | Trends with volume emphasis | \`[{x, y1, y2}]\` |
| composed | Mix bars + lines | \`[{x, y1, y2}]\` with series.type |
| pie | Part-to-whole (%) | \`[{name, value}]\` |
| scatter | Correlation analysis | \`[{x, y}]\` |
| radar | Multi-dimensional comparison | \`[{axis, A, B}]\` |
| radialBar | Progress/gauges | \`[{name, value}]\` |
| funnel | Conversion stages | \`[{name, value}]\` |
| treemap | Hierarchical proportions | \`[{name, value}]\` |

## EXAMPLES

### Bar Chart
\`\`\`chart
{"chart":"bar","title":"Revenue by Quarter","data":[{"quarter":"Q1","revenue":100000},{"quarter":"Q2","revenue":150000}],"xKey":"quarter","series":[{"key":"revenue","label":"Revenue"}]}
\`\`\`

### Line Chart
\`\`\`chart
{"chart":"line","title":"Performance","data":[{"period":"Q1","tvpi":1.2},{"period":"Q2","tvpi":1.5}],"xKey":"period","series":[{"key":"tvpi","label":"TVPI","color":"#4f46e5"}]}
\`\`\`

### Area Chart
\`\`\`chart
{"chart":"area","title":"Sales Volume","data":[{"month":"Jan","sales":1000},{"month":"Feb","sales":1500}],"xKey":"month","series":[{"key":"sales","label":"Sales"}],"options":{"stacked":true}}
\`\`\`

### Composed Chart (Bar + Line)
\`\`\`chart
{"chart":"composed","title":"Cashflow","data":[{"period":"Q1","calls":1000000,"net":-500000}],"xKey":"period","series":[{"key":"calls","type":"bar","color":"#ef4444"},{"key":"net","type":"line","yAxisId":"right"}],"yAxis":{"left":{"label":"Amount"},"right":{"label":"Net"}}}
\`\`\`

### Pie Chart
\`\`\`chart
{"chart":"pie","title":"Market Share","data":[{"name":"Product A","value":400},{"name":"Product B","value":300},{"name":"Product C","value":200}],"nameKey":"name","valueKey":"value"}
\`\`\`

### Donut Chart (Pie with innerRadius)
\`\`\`chart
{"chart":"pie","title":"Revenue Split","data":[{"name":"Services","value":60},{"name":"Products","value":40}],"nameKey":"name","valueKey":"value","options":{"innerRadius":50}}
\`\`\`

### Scatter Chart
\`\`\`chart
{"chart":"scatter","title":"Price vs Volume","data":[{"price":100,"volume":500},{"price":150,"volume":400}],"xKey":"price","yKey":"volume","series":[{"key":"data","label":"Products"}]}
\`\`\`

### Radar Chart
\`\`\`chart
{"chart":"radar","title":"Skills Comparison","data":[{"skill":"Speed","A":120,"B":110},{"skill":"Power","A":98,"B":130}],"axisKey":"skill","series":[{"key":"A","label":"Team A"},{"key":"B","label":"Team B"}]}
\`\`\`

### RadialBar Chart (Progress)
\`\`\`chart
{"chart":"radialBar","title":"Goal Progress","data":[{"name":"Sales","value":80},{"name":"Users","value":65}],"nameKey":"name","valueKey":"value"}
\`\`\`

### Funnel Chart
\`\`\`chart
{"chart":"funnel","title":"Conversion Funnel","data":[{"name":"Visits","value":5000},{"name":"Cart","value":2500},{"name":"Purchase","value":1000}],"nameKey":"name","valueKey":"value"}
\`\`\`

### Treemap
\`\`\`chart
{"chart":"treemap","title":"Budget Allocation","data":[{"name":"Engineering","value":500000},{"name":"Marketing","value":200000},{"name":"Sales","value":300000}],"nameKey":"name","dataKey":"value"}
\`\`\`

## CONFIGURATION

### Series (for bar/line/area/composed/radar)
- key: (required) Field name in data
- label: Display name
- type: "bar"|"line"|"area" (composed only)
- color: Hex color
- yAxisId: "left"|"right"
- dot: Show dots on lines

### Keys (for pie/scatter/radar/funnel/treemap)
- nameKey: Field for labels (default: "name")
- valueKey: Field for values (default: "value")
- xKey/yKey: For scatter charts
- axisKey: For radar axis labels
- dataKey: For treemap values

### Options
- stacked: Stack bars/areas
- referenceZero: Show y=0 line
- innerRadius: For donut charts (0-100)
- showLabels: Show value labels
- startAngle/endAngle: For radialBar

## COLORS
- Blue #4f46e5 - Primary
- Cyan #06b6d4 - Secondary
- Green #22c55e - Positive
- Amber #f59e0b - Warning
- Red #ef4444 - Negative
- Purple #8b5cf6 - Accent
- Pink #ec4899 - Highlight
- Teal #14b8a6 - Alternative

Numbers auto-format: 1K, 1M, 1B`,

    input_schema: {
        type: 'object',
        properties: {
            chart: {
                type: 'string',
                enum: ['bar', 'line', 'area', 'composed', 'pie', 'scatter', 'radar', 'radialBar', 'funnel', 'treemap'],
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
                description: 'Field name to use for X-axis (for bar/line/area/composed/scatter)',
            },
            yKey: {
                type: 'string',
                description: 'Field name for Y values (for scatter charts)',
            },
            nameKey: {
                type: 'string',
                description: 'Field name for labels (for pie/funnel/radialBar/treemap, default: "name")',
            },
            valueKey: {
                type: 'string',
                description: 'Field name for values (for pie/funnel/radialBar, default: "value")',
            },
            axisKey: {
                type: 'string',
                description: 'Field name for radar axis labels',
            },
            dataKey: {
                type: 'string',
                description: 'Field name for treemap values',
            },
            series: {
                type: 'array',
                description: 'Array of series to plot (for bar/line/area/composed/radar)',
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
                            enum: ['bar', 'line', 'area'],
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
                        description: 'Stack bars/areas',
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
                    innerRadius: {
                        type: 'number',
                        description: 'Inner radius for donut/radialBar charts (0-100)',
                    },
                    showLabels: {
                        type: 'boolean',
                        description: 'Show value labels on pie/funnel',
                    },
                    startAngle: {
                        type: 'number',
                        description: 'Start angle for radialBar (default: 180)',
                    },
                    endAngle: {
                        type: 'number',
                        description: 'End angle for radialBar (default: 0)',
                    },
                },
            },
        },
        required: ['chart', 'data'],
    },
};

/**
 * System prompt addition for chart capabilities.
 * Include this in your agent's system prompt to enable chart creation.
 */
export const chartSystemPromptAddition = `
# Chart Visualization Capability

You can create interactive charts by including markdown code blocks with the language "chart".

## Chart Types

| Type | Use Case | Required Fields |
|------|----------|-----------------|
| bar | Category comparisons | xKey, series |
| line | Trends over time | xKey, series |
| area | Trends with volume | xKey, series |
| composed | Mix bars + lines | xKey, series with type |
| pie | Part-to-whole | nameKey, valueKey |
| scatter | Correlation | xKey, yKey |
| radar | Multi-dimensional | axisKey, series |
| radialBar | Progress/gauges | nameKey, valueKey |
| funnel | Conversion stages | nameKey, valueKey |
| treemap | Hierarchical data | nameKey, dataKey |

## Quick Examples

Bar: \`{"chart":"bar","data":[{"x":"A","y":10}],"xKey":"x","series":[{"key":"y"}]}\`
Pie: \`{"chart":"pie","data":[{"name":"A","value":60},{"name":"B","value":40}]}\`
Scatter: \`{"chart":"scatter","data":[{"x":1,"y":2}],"xKey":"x","yKey":"y"}\`

Use charts when:
- User requests visualization
- 3+ data points to display
- Visual form clarifies comparisons/trends

Colors: Blue #4f46e5 (primary), Green #22c55e (positive), Red #ef4444 (negative)
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
