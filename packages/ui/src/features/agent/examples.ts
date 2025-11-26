/**
 * Chart creation examples for testing and reference.
 *
 * These examples demonstrate how to use the chart functionality
 * from both AI agents and TypeScript code.
 */

import {
    buildCashflowComposedChart,
    buildPerformanceLineChart,
    buildScenarioComparisonBarChart,
    buildScenarioDeltaPercentChart,
    buildNavLineChart,
    toChartMarkdown,
} from './visualization';

/**
 * Example 1: Simple bar chart (markdown)
 */
export const exampleBarChartMarkdown = `
Here's a comparison of revenue across quarters:

\`\`\`chart
{
  "version": "1.0",
  "chart": "bar",
  "title": "Quarterly Revenue",
  "description": "Revenue performance by quarter",
  "data": [
    { "quarter": "Q1 2024", "revenue": 125000 },
    { "quarter": "Q2 2024", "revenue": 145000 },
    { "quarter": "Q3 2024", "revenue": 160000 },
    { "quarter": "Q4 2024", "revenue": 180000 }
  ],
  "xKey": "quarter",
  "series": [
    {
      "key": "revenue",
      "label": "Revenue",
      "type": "bar",
      "color": "#4f46e5"
    }
  ],
  "yAxis": {
    "left": { "label": "Amount ($)" }
  }
}
\`\`\`

Revenue shows consistent growth throughout 2024.
`;

/**
 * Example 2: Line chart with multiple series (markdown)
 */
export const exampleLineChartMarkdown = `
Here's the fund performance over time:

\`\`\`chart
{
  "version": "1.0",
  "chart": "line",
  "title": "Fund Performance Metrics",
  "description": "TVPI, DPI, and RVPI over time",
  "data": [
    { "period": "2024-Q1", "tvpi": 1.2, "dpi": 0.3, "rvpi": 0.9 },
    { "period": "2024-Q2", "tvpi": 1.4, "dpi": 0.5, "rvpi": 0.9 },
    { "period": "2024-Q3", "tvpi": 1.6, "dpi": 0.7, "rvpi": 0.9 },
    { "period": "2024-Q4", "tvpi": 1.8, "dpi": 0.9, "rvpi": 0.9 }
  ],
  "xKey": "period",
  "series": [
    {
      "key": "tvpi",
      "label": "TVPI",
      "type": "line",
      "color": "#4f46e5",
      "dot": false
    },
    {
      "key": "dpi",
      "label": "DPI",
      "type": "line",
      "color": "#16a34a",
      "dot": false
    },
    {
      "key": "rvpi",
      "label": "RVPI",
      "type": "line",
      "color": "#f59e0b",
      "dot": false
    }
  ],
  "yAxis": {
    "left": { "label": "Multiple (x)" }
  },
  "options": {
    "referenceZero": false
  }
}
\`\`\`

The fund shows strong performance with TVPI growing to 1.8x.
`;

/**
 * Example 3: Composed chart with dual Y-axis (markdown)
 */
export const exampleComposedChartMarkdown = `
Here's the cashflow analysis:

\`\`\`chart
{
  "version": "1.0",
  "chart": "composed",
  "title": "Fund Cashflow Timeline",
  "description": "Capital calls, distributions, and net cashflow",
  "data": [
    { "period": "2024-Q1", "calls": 2000000, "distributions": 500000, "net": -1500000 },
    { "period": "2024-Q2", "calls": 1500000, "distributions": 800000, "net": -700000 },
    { "period": "2024-Q3", "calls": 1000000, "distributions": 1200000, "net": 200000 },
    { "period": "2024-Q4", "calls": 500000, "distributions": 1800000, "net": 1300000 }
  ],
  "xKey": "period",
  "series": [
    {
      "key": "calls",
      "label": "Capital Calls",
      "type": "bar",
      "color": "#ef4444"
    },
    {
      "key": "distributions",
      "label": "Distributions",
      "type": "bar",
      "color": "#22c55e"
    },
    {
      "key": "net",
      "label": "Net Cashflow",
      "type": "line",
      "color": "#0ea5e9",
      "yAxisId": "right",
      "dot": false
    }
  ],
  "yAxis": {
    "left": { "label": "Amount ($)" },
    "right": { "label": "Net CF ($)" }
  },
  "options": {
    "referenceZero": true
  }
}
\`\`\`

The fund transitions from net negative to net positive cashflow in Q3.
`;

/**
 * Example 4: Using TypeScript builders
 */
export function generateCashflowChart() {
    const chart = buildCashflowComposedChart({
        title: 'Fund Cashflow Analysis',
        description: 'Quarterly cashflows with net overlay',
        rows: [
            { period: '2024-Q1', calls: 2000000, distributions: 500000 },
            { period: '2024-Q2', calls: 1500000, distributions: 800000 },
            { period: '2024-Q3', calls: 1000000, distributions: 1200000 },
            { period: '2024-Q4', calls: 500000, distributions: 1800000 },
        ],
        collapseInitially: false,
    });

    return toChartMarkdown(chart);
}

/**
 * Example 5: Performance chart with TypeScript
 */
export function generatePerformanceChart() {
    const chart = buildPerformanceLineChart({
        title: 'Fund Performance',
        description: 'TVPI, DPI, and RVPI over time',
        rows: [
            { period: '2024-Q1', tvpi: 1.2, dpi: 0.3, rvpi: 0.9 },
            { period: '2024-Q2', tvpi: 1.4, dpi: 0.5, rvpi: 0.9 },
            { period: '2024-Q3', tvpi: 1.6, dpi: 0.7, rvpi: 0.9 },
            { period: '2024-Q4', tvpi: 1.8, dpi: 0.9, rvpi: 0.9 },
        ],
    });

    return toChartMarkdown(chart);
}

/**
 * Example 6: Scenario comparison
 */
export function generateScenarioComparisonChart() {
    const chart = buildScenarioComparisonBarChart({
        title: 'Base vs Optimistic Scenario',
        leftLabel: 'Base Case',
        rightLabel: 'Optimistic Case',
        metrics: [
            { label: 'Final TVPI', left: 2.5, right: 3.2 },
            { label: 'IRR (%)', left: 18, right: 25 },
            { label: 'Total Distributions ($M)', left: 125, right: 160 },
        ],
        description: 'Comparison of key metrics across scenarios',
    });

    return toChartMarkdown(chart);
}

/**
 * Example 7: Delta percentage chart
 */
export function generateDeltaChart() {
    const chart = buildScenarioDeltaPercentChart({
        title: 'Performance vs Plan',
        metrics: [
            { label: 'Revenue', left: 1000000, right: 1200000 },
            { label: 'EBITDA', left: 250000, right: 320000 },
            { label: 'Net Income', left: 150000, right: 180000 },
        ],
        description: 'Percentage change from plan',
    });

    return toChartMarkdown(chart);
}

/**
 * Example 8: NAV timeline
 */
export function generateNavChart() {
    const chart = buildNavLineChart({
        title: 'Fund NAV Over Time',
        description: 'Net Asset Value progression',
        rows: [
            { period: '2024-Q1', nav: 10000000 },
            { period: '2024-Q2', nav: 12000000 },
            { period: '2024-Q3', nav: 15000000 },
            { period: '2024-Q4', nav: 18000000 },
        ],
    });

    return toChartMarkdown(chart);
}

/**
 * Example 9: Complete agent response with chart
 */
export const exampleAgentResponseWithChart = `
I've analyzed the fund performance for Q1-Q4 2024. Here are the key findings:

## Performance Summary

- **Final TVPI:** 1.8x
- **Final DPI:** 0.9x
- **Net Cashflow:** Positive since Q3

## Visual Analysis

${generatePerformanceChart()}

## Cashflow Breakdown

${generateCashflowChart()}

## Recommendations

1. The fund is performing well above industry benchmarks
2. Cashflow turned positive in Q3, indicating maturity
3. Consider planning distributions for Q1 2025

Would you like me to run a Monte Carlo simulation to project future scenarios?
`;

/**
 * Example 10: Error handling example
 */
export const exampleInvalidChart = `
This will fall back to a code block because the JSON is invalid:

\`\`\`chart
{
  "chart": "bar",
  // Missing required fields
  "title": "Invalid Chart"
}
\`\`\`

The UI will render this as a regular code block.
`;

/**
 * Test data generator for interactive testing
 */
export function generateTestData(periods: number) {
    const data = [];
    const startDate = new Date('2024-01-01');

    for (let i = 0; i < periods; i++) {
        const quarter = Math.floor(i / 3) + 1;
        const year = 2024 + Math.floor(i / 4);
        const period = `${year}-Q${quarter}`;

        data.push({
            period,
            tvpi: 1.0 + (i * 0.15) + (Math.random() * 0.1),
            dpi: 0.2 + (i * 0.08) + (Math.random() * 0.05),
            rvpi: 0.8 + (i * 0.07) + (Math.random() * 0.05),
            calls: Math.floor(500000 + Math.random() * 1500000),
            distributions: Math.floor(300000 + Math.random() * 2000000),
            nav: Math.floor(5000000 + (i * 1000000) + (Math.random() * 500000)),
        });
    }

    return data;
}
