/**
 * Snapshot test for serverless canvas rendering
 * Generates sample images for visual verification
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { renderToBuffer } from '../src/render/serverlessRender.js';
import type { FragmentTemplate } from '../src/types.js';

const SNAPSHOTS_DIR = join(__dirname, '__snapshots__');

// Ensure snapshots directory exists
if (!existsSync(SNAPSHOTS_DIR)) {
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

describe('render snapshots', () => {
  it('renders fund parameters template', () => {
    const template: FragmentTemplate = {
      title: 'Fund Parameters',
      entityType: 'fund',
      sections: [
        {
          title: 'Identity',
          layout: 'grid-3',
          fields: [
            { label: 'Firm Name', key: 'firmName' },
            { label: 'Fund Name', key: 'fundName' },
            { label: 'Vintage Year', key: 'vintageYear', format: 'number' },
          ],
        },
        {
          title: 'Financials',
          layout: 'grid-2',
          fields: [
            { label: 'Target Size', key: 'targetSize', format: 'currency', currency: 'USD' },
            { label: 'Committed Capital', key: 'committedCapital', format: 'currency', currency: 'USD' },
            { label: 'Called Capital', key: 'calledCapital', format: 'currency', currency: 'USD' },
            { label: 'Distributions', key: 'distributions', format: 'currency', currency: 'USD' },
          ],
        },
        {
          title: 'Performance',
          layout: 'grid-4',
          fields: [
            { label: 'IRR', key: 'irr', format: 'percent', highlight: 'success' },
            { label: 'TVPI', key: 'tvpi', format: 'number', decimals: 2 },
            { label: 'DPI', key: 'dpi', format: 'number', decimals: 2 },
            { label: 'RVPI', key: 'rvpi', format: 'number', decimals: 2 },
          ],
        },
      ],
      footer: 'Data as of Q4 2024',
    };

    const data = {
      firmName: 'Sequoia Capital',
      fundName: 'Sequoia Capital Fund XV',
      vintageYear: 2021,
      targetSize: 2000000000,
      committedCapital: 2150000000,
      calledCapital: 1720000000,
      distributions: 860000000,
      irr: 0.285,
      tvpi: 1.82,
      dpi: 0.50,
      rvpi: 1.32,
    };

    const buffer = renderToBuffer(template, data);

    // Save snapshot for visual verification
    writeFileSync(join(SNAPSHOTS_DIR, 'fund-parameters.png'), buffer);

    // Basic assertions
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // Non-trivial image
  });

  it('renders status dashboard template', () => {
    const template: FragmentTemplate = {
      title: 'Portfolio Status',
      sections: [
        {
          title: 'Health Indicators',
          layout: 'grid-4',
          fields: [
            { label: 'On Track', key: 'onTrack', format: 'number', highlight: 'success' },
            { label: 'At Risk', key: 'atRisk', format: 'number', highlight: 'warning' },
            { label: 'Underperforming', key: 'underperforming', format: 'number', highlight: 'error' },
            { label: 'Total Funds', key: 'total', format: 'number', highlight: 'info' },
          ],
        },
        {
          title: 'Allocation',
          layout: 'list',
          fields: [
            { label: 'Private Equity', key: 'peAlloc', format: 'percent', unit: 'of portfolio' },
            { label: 'Venture Capital', key: 'vcAlloc', format: 'percent', unit: 'of portfolio' },
            { label: 'Real Estate', key: 'reAlloc', format: 'percent', unit: 'of portfolio' },
            { label: 'Infrastructure', key: 'infraAlloc', format: 'percent', unit: 'of portfolio' },
          ],
        },
      ],
    };

    const data = {
      onTrack: 42,
      atRisk: 8,
      underperforming: 3,
      total: 53,
      peAlloc: 35,
      vcAlloc: 25,
      reAlloc: 25,
      infraAlloc: 15,
    };

    const buffer = renderToBuffer(template, data);

    writeFileSync(join(SNAPSHOTS_DIR, 'status-dashboard.png'), buffer);

    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('renders with missing data gracefully', () => {
    const template: FragmentTemplate = {
      title: 'Partial Data',
      sections: [
        {
          title: 'Available',
          fields: [
            { label: 'Known Value', key: 'known' },
            { label: 'Missing Value', key: 'missing' },
            { label: 'Null Value', key: 'nullValue' },
          ],
        },
      ],
    };

    const data = {
      known: 'This exists',
      nullValue: null,
      // 'missing' is intentionally not provided
    };

    const buffer = renderToBuffer(template, data as Record<string, unknown>);

    writeFileSync(join(SNAPSHOTS_DIR, 'partial-data.png'), buffer);

    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('renders wide format', () => {
    const template: FragmentTemplate = {
      title: 'Wide Layout',
      sections: [
        {
          title: 'Many Columns',
          layout: 'grid-4',
          fields: [
            { label: 'Col 1', key: 'a' },
            { label: 'Col 2', key: 'b' },
            { label: 'Col 3', key: 'c' },
            { label: 'Col 4', key: 'd' },
            { label: 'Col 5', key: 'e' },
            { label: 'Col 6', key: 'f' },
            { label: 'Col 7', key: 'g' },
            { label: 'Col 8', key: 'h' },
          ],
        },
      ],
    };

    const data = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };

    const buffer = renderToBuffer(template, data, { width: 800 });

    writeFileSync(join(SNAPSHOTS_DIR, 'wide-layout.png'), buffer);

    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('renders mixed fields and table', () => {
    const template: FragmentTemplate = {
      title: 'Fund Overview with Transactions',
      sections: [
        {
          title: 'Summary',
          layout: 'grid-3',
          fields: [
            { label: 'Fund Name', key: 'fundName' },
            { label: 'Vintage', key: 'vintage', format: 'number' },
            { label: 'NAV', key: 'nav', format: 'currency' },
          ],
        },
        {
          title: 'Recent Transactions',
          layout: 'table',
          columns: [
            { header: 'Date', key: 'date', format: 'date' },
            { header: 'Type', key: 'type' },
            { header: 'Amount', key: 'amount', format: 'currency' },
            { header: 'Status', key: 'status' },
          ],
          dataKey: 'transactions',
        },
      ],
      footer: 'Data as of January 2024',
    };

    const data = {
      fundName: 'Acme Venture Fund V',
      vintage: 2022,
      nav: 150000000,
      transactions: [
        { date: '2024-01-15', type: 'Capital Call', amount: 5000000, status: 'Completed' },
        { date: '2024-01-08', type: 'Distribution', amount: 2500000, status: 'Completed' },
        { date: '2023-12-20', type: 'Capital Call', amount: 7500000, status: 'Completed' },
        { date: '2023-12-01', type: 'Fee', amount: 125000, status: 'Completed' },
      ],
    };

    const buffer = renderToBuffer(template, data);

    writeFileSync(join(SNAPSHOTS_DIR, 'mixed-fields-table.png'), buffer);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(5000);
  });
});
