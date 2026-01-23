/**
 * Chart creation tool definition for AI agents.
 *
 * This provides a tool schema that AI agents can use to understand
 * how to create charts in their responses.
 */

import type { AgentChartSpec, RechartsChartSpec, VegaLiteChartSpec } from './chat/AgentChart';

/**
 * Tool definition for creating charts.
 * Can be used with Claude, OpenAI, or other LLM tool-calling systems.
 */
export const createChartToolDefinition = {
    name: 'create_chart',
    description: `Create an interactive chart visualization that will be rendered in the UI.

IMPORTANT: You don't actually "call" this tool. Instead, you include a markdown code block with language "chart" in your response.

## CHART LIBRARIES

Two chart libraries are available:

### 1. Recharts (Default) - Simple Charts
For standard bar, line, pie, area charts. Use when you need quick, simple visualizations.

\`\`\`chart
{
  "library": "recharts",
  "chart": "bar|line|area|composed|pie|scatter|radar|radialBar|funnel|treemap",
  "title": "Chart Title",
  "data": [...],
  "xKey": "...",
  "series": [...]
}
\`\`\`

### 2. Vega-Lite (Advanced) - Complex Visualizations
For heatmaps, geographic maps, layered charts, faceted charts, statistical plots.

\`\`\`chart
{
  "library": "vega-lite",
  "title": "Chart Title",
  "spec": {
    "data": {"values": [...]},
    "mark": "bar|line|point|rect|arc|...",
    "encoding": {...}
  }
}
\`\`\`

## WHEN TO USE EACH LIBRARY

| Use Case | Library |
|----------|---------|
| Simple bar, line, pie charts | recharts (default) |
| Heatmaps / correlation matrices | **vega-lite** |
| Geographic maps | **vega-lite** |
| Faceted / small multiples | **vega-lite** |
| Layered charts (scatter + regression) | **vega-lite** |
| Statistical plots (boxplot, violin) | **vega-lite** |
| Standard business charts | recharts |

---

## RECHARTS EXAMPLES

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

Numbers auto-format: 1K, 1M, 1B

---

## VEGA-LITE EXAMPLES

### Heatmap
\`\`\`chart
{"library":"vega-lite","title":"Correlation Matrix","spec":{"data":{"values":[{"x":"A","y":"A","v":1},{"x":"A","y":"B","v":0.7},{"x":"B","y":"A","v":0.7},{"x":"B","y":"B","v":1}]},"mark":"rect","encoding":{"x":{"field":"x","type":"nominal"},"y":{"field":"y","type":"nominal"},"color":{"field":"v","type":"quantitative","scale":{"scheme":"redblue","domain":[-1,1]}}}}}
\`\`\`

### Layered Chart (Scatter + Trend Line)
\`\`\`chart
{"library":"vega-lite","title":"Sales Trend","spec":{"data":{"values":[{"x":1,"y":10},{"x":2,"y":18},{"x":3,"y":25},{"x":4,"y":31}]},"layer":[{"mark":"point","encoding":{"x":{"field":"x"},"y":{"field":"y"}}},{"mark":{"type":"line","color":"red"},"transform":[{"regression":"y","on":"x"}],"encoding":{"x":{"field":"x"},"y":{"field":"y"}}}]}}
\`\`\`

### Faceted Chart
\`\`\`chart
{"library":"vega-lite","title":"Sales by Category","spec":{"data":{"values":[{"cat":"A","region":"N","val":10},{"cat":"A","region":"S","val":15},{"cat":"B","region":"N","val":8},{"cat":"B","region":"S","val":12}]},"mark":"bar","encoding":{"x":{"field":"region"},"y":{"field":"val"},"color":{"field":"region"}},"facet":{"field":"cat","columns":2}}}
\`\`\`

### Box Plot
\`\`\`chart
{"library":"vega-lite","title":"Distribution","spec":{"data":{"values":[{"group":"A","val":10},{"group":"A","val":15},{"group":"A","val":12},{"group":"B","val":20},{"group":"B","val":25}]},"mark":"boxplot","encoding":{"x":{"field":"group"},"y":{"field":"val","type":"quantitative"}}}}
\`\`\`

## VEGA-LITE REFERENCE

### Mark Types
- bar, line, point, area, rect, arc, circle, text, boxplot, errorbar

### Encoding Types
- quantitative (Q): Numbers
- nominal (N): Categories
- ordinal (O): Ordered categories
- temporal (T): Dates

### Color Schemes
- Sequential: blues, greens, viridis
- Diverging: redblue, redyellowgreen
- Categorical: category10, tableau10

---

## INTERACTIVE DASHBOARDS

For interactive dashboards with cross-filtering and linked views, use \`options.mode: "dashboard"\`.
Dashboard mode enables:
- Larger default height (500px vs 280px)
- Fullscreen button for exploration
- "Interactive" badge indicator

### Dashboard with Cross-Filter Selection
Click on a bar to filter the line chart below:

\`\`\`chart
{
  "library": "vega-lite",
  "title": "Sales Dashboard",
  "description": "Click a category to filter the trend",
  "options": {"mode": "dashboard", "height": 600},
  "spec": {
    "data": {"values": [
      {"category": "Electronics", "month": "Jan", "sales": 100},
      {"category": "Electronics", "month": "Feb", "sales": 120},
      {"category": "Electronics", "month": "Mar", "sales": 140},
      {"category": "Clothing", "month": "Jan", "sales": 80},
      {"category": "Clothing", "month": "Feb", "sales": 95},
      {"category": "Clothing", "month": "Mar", "sales": 110},
      {"category": "Food", "month": "Jan", "sales": 60},
      {"category": "Food", "month": "Feb", "sales": 70},
      {"category": "Food", "month": "Mar", "sales": 85}
    ]},
    "params": [{"name": "categorySelect", "select": {"type": "point", "fields": ["category"]}}],
    "vconcat": [
      {
        "mark": "bar",
        "encoding": {
          "x": {"field": "category", "type": "nominal"},
          "y": {"aggregate": "sum", "field": "sales"},
          "color": {"condition": {"param": "categorySelect", "field": "category"}, "value": "lightgray"},
          "opacity": {"condition": {"param": "categorySelect", "value": 1}, "value": 0.5}
        }
      },
      {
        "mark": "line",
        "transform": [{"filter": {"param": "categorySelect"}}],
        "encoding": {
          "x": {"field": "month", "type": "ordinal"},
          "y": {"field": "sales", "type": "quantitative"},
          "color": {"field": "category", "type": "nominal"}
        }
      }
    ]
  }
}
\`\`\`

### Dashboard with Interval Brush Selection
Brush to select a time range in the overview, detail view updates:

\`\`\`chart
{
  "library": "vega-lite",
  "title": "Focus + Context",
  "options": {"mode": "dashboard", "height": 500},
  "spec": {
    "data": {"values": [
      {"date": "2024-01-01", "value": 28}, {"date": "2024-02-01", "value": 55},
      {"date": "2024-03-01", "value": 43}, {"date": "2024-04-01", "value": 91},
      {"date": "2024-05-01", "value": 81}, {"date": "2024-06-01", "value": 53},
      {"date": "2024-07-01", "value": 19}, {"date": "2024-08-01", "value": 87},
      {"date": "2024-09-01", "value": 52}, {"date": "2024-10-01", "value": 48}
    ]},
    "vconcat": [
      {
        "height": 250,
        "mark": "area",
        "encoding": {
          "x": {"field": "date", "type": "temporal", "scale": {"domain": {"param": "brush"}}, "axis": {"title": ""}},
          "y": {"field": "value", "type": "quantitative"}
        }
      },
      {
        "height": 60,
        "params": [{"name": "brush", "select": {"type": "interval", "encodings": ["x"]}}],
        "mark": "area",
        "encoding": {
          "x": {"field": "date", "type": "temporal"},
          "y": {"field": "value", "type": "quantitative", "axis": {"tickCount": 3}}
        }
      }
    ]
  }
}
\`\`\`

### Dashboard with Legend Filter
Click legend items to filter:

\`\`\`chart
{
  "library": "vega-lite",
  "title": "Multi-Series with Legend Filter",
  "options": {"mode": "dashboard"},
  "spec": {
    "data": {"values": [
      {"series": "A", "x": 1, "y": 10}, {"series": "A", "x": 2, "y": 15},
      {"series": "B", "x": 1, "y": 20}, {"series": "B", "x": 2, "y": 12},
      {"series": "C", "x": 1, "y": 8}, {"series": "C", "x": 2, "y": 18}
    ]},
    "params": [{"name": "seriesFilter", "select": {"type": "point", "fields": ["series"]}, "bind": "legend"}],
    "mark": "line",
    "encoding": {
      "x": {"field": "x", "type": "quantitative"},
      "y": {"field": "y", "type": "quantitative"},
      "color": {"field": "series", "type": "nominal"},
      "opacity": {"condition": {"param": "seriesFilter", "value": 1}, "value": 0.2}
    }
  }
}
\`\`\`

### Dashboard with Input Widgets
Bind parameters to sliders and dropdowns:

\`\`\`chart
{
  "library": "vega-lite",
  "title": "Interactive Controls",
  "options": {"mode": "dashboard"},
  "spec": {
    "params": [
      {"name": "threshold", "value": 50, "bind": {"input": "range", "min": 0, "max": 100, "step": 5}},
      {"name": "colorScheme", "value": "category10", "bind": {"input": "select", "options": ["category10", "tableau10", "set1"]}}
    ],
    "data": {"values": [{"x": "A", "y": 30}, {"x": "B", "y": 60}, {"x": "C", "y": 80}, {"x": "D", "y": 45}]},
    "mark": "bar",
    "encoding": {
      "x": {"field": "x", "type": "nominal"},
      "y": {"field": "y", "type": "quantitative"},
      "color": {
        "condition": {"test": "datum.y > threshold", "value": "steelblue"},
        "value": "lightgray"
      }
    }
  }
}
\`\`\`

### DASHBOARD OPTIONS

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| mode | "chart" \\| "dashboard" | "chart" | Dashboard mode enables fullscreen + larger height |
| height | number | 280/500 | Explicit height (auto-calculated for vconcat) |
| enableFullscreen | boolean | true (dashboard) | Show fullscreen button |
| renderer | "canvas" \\| "svg" | "canvas" | SVG for print quality |
| parameterValues | object | {} | Set initial param values (see below) |

### SETTING PARAMETER VALUES

Override default param values to test different configurations:

\`\`\`chart
{
  "library": "vega-lite",
  "options": {
    "mode": "dashboard",
    "parameterValues": {"threshold": 75, "colorScheme": "tableau10"}
  },
  "spec": {
    "params": [
      {"name": "threshold", "value": 50, "bind": {"input": "range", "min": 0, "max": 100}},
      {"name": "colorScheme", "value": "category10", "bind": {"input": "select", "options": ["category10", "tableau10"]}}
    ],
    ...
  }
}
\`\`\`

The chart renders with threshold=75 (instead of default 50). Interactive controls still work.

### INTERACTIVE FEATURES (params)

| Selection Type | Use Case | Example |
|---------------|----------|---------|
| point | Click to select | \`{"select": {"type": "point", "fields": ["category"]}}\` |
| interval | Brush selection | \`{"select": {"type": "interval", "encodings": ["x"]}}\` |
| bind: "legend" | Legend toggle | \`{"select": {...}, "bind": "legend"}\` |
| bind: input | Widgets | \`{"bind": {"input": "range", "min": 0, "max": 100}}\` |`,

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
    // Check if it's a Vega-Lite spec
    if (spec.library === 'vega-lite') {
        const vegaSpec = spec as VegaLiteChartSpec;
        if (!vegaSpec.spec) {
            throw new Error('Invalid Vega-Lite chart spec: missing required "spec" field');
        }
        const json = JSON.stringify(spec, null, 2);
        return `\`\`\`chart\n${json}\n\`\`\``;
    }

    // Recharts validation
    const rechartsSpec = spec as RechartsChartSpec;
    if (!rechartsSpec.chart || !rechartsSpec.data || !rechartsSpec.xKey || !rechartsSpec.series) {
        throw new Error('Invalid chart spec: missing required fields (chart, data, xKey, series)');
    }

    if (!Array.isArray(rechartsSpec.data)) {
        throw new Error('Invalid chart spec: data must be an array');
    }

    if (!Array.isArray(rechartsSpec.series) || rechartsSpec.series.length === 0) {
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
