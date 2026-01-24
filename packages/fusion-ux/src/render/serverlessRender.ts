/**
 * Serverless canvas rendering for fusion fragments
 * Uses @napi-rs/canvas for Node.js environments without DOM
 */

import { createCanvas } from '@napi-rs/canvas';
import type { FragmentTemplate, FieldTemplate, ColumnTemplate } from '../types.js';

// Design tokens
const COLORS = {
  background: '#f9fafb',
  cardBg: '#ffffff',
  border: '#e5e7eb',
  text: '#1f2937',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  accent: '#2563eb',
  success: '#15803d',
  warning: '#ca8a04',
  error: '#dc2626',
  info: '#2563eb',
};

const FONTS = {
  label: 'bold 11px Inter, system-ui, sans-serif',
  value: '500 14px Inter, system-ui, sans-serif',
  title: '600 16px Inter, system-ui, sans-serif',
  sectionTitle: 'bold 11px Inter, system-ui, sans-serif',
};

interface RenderOptions {
  width?: number;
  padding?: number;
  fieldHeight?: number;
  sectionGap?: number;
  tableRowHeight?: number;
}

/**
 * Format a value for display (fields)
 */
function formatValue(value: unknown, field: FieldTemplate): string {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (field.format) {
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      const decimals = field.decimals ?? 2;
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      }).format(num);
    }

    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: field.currency || 'USD',
        minimumFractionDigits: field.decimals ?? 0,
        maximumFractionDigits: field.decimals ?? 0,
      }).format(num);
    }

    case 'percent': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      const pct = num < 1 && num > -1 && num !== 0 ? num * 100 : num;
      return `${pct.toFixed(field.decimals ?? 1)}%`;
    }

    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    }

    case 'boolean':
      return value ? 'Yes' : 'No';

    default:
      return String(value);
  }
}

/**
 * Format a value for display (columns)
 */
function formatColumnValue(value: unknown, column: ColumnTemplate): string {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (column.format) {
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: column.decimals ?? 2,
      }).format(num);
    }

    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: column.currency || 'USD',
        minimumFractionDigits: column.decimals ?? 0,
        maximumFractionDigits: column.decimals ?? 0,
      }).format(num);
    }

    case 'percent': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      const pct = num < 1 && num > -1 && num !== 0 ? num * 100 : num;
      return `${pct.toFixed(column.decimals ?? 1)}%`;
    }

    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    }

    case 'boolean':
      return value ? 'Yes' : 'No';

    default:
      return String(value);
  }
}

/**
 * Calculate the required canvas height for a template
 */
function calculateHeight(
  template: FragmentTemplate,
  data: Record<string, unknown>,
  options: RenderOptions
): number {
  const { padding = 20, fieldHeight = 50, sectionGap = 24, tableRowHeight = 32 } = options;

  let height = padding * 2;

  // Title
  if (template.title) {
    height += 40;
  }

  // Sections
  for (const section of template.sections) {
    height += 30; // Section header

    if (section.layout === 'table') {
      // Table: header row + data rows
      const rows = section.dataKey && Array.isArray(data[section.dataKey])
        ? (data[section.dataKey] as unknown[]).length
        : 0;
      height += 36; // Table header
      height += Math.max(rows, 1) * tableRowHeight; // At least 1 row for "no data"
    } else if (section.fields && section.fields.length > 0) {
      const cols = getColumnCount(section.layout);
      const rows = Math.ceil(section.fields.length / cols);
      height += rows * fieldHeight;
    }

    height += sectionGap;
  }

  // Footer
  if (template.footer) {
    height += 30;
  }

  return height;
}

function getColumnCount(layout?: string): number {
  switch (layout) {
    case 'grid-2':
      return 2;
    case 'grid-4':
      return 4;
    case 'list':
      return 1;
    case 'grid-3':
    default:
      return 3;
  }
}

/**
 * Render a fusion fragment template to PNG using serverless canvas
 *
 * @param template - The template to render
 * @param data - Data values for fields
 * @param options - Render options
 * @returns PNG buffer
 */
export function renderToBuffer(
  template: FragmentTemplate,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): Buffer {
  const { width = 600, padding = 20, fieldHeight = 50, tableRowHeight = 32 } = options;
  const height = calculateHeight(template, data, options);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Card background
  ctx.fillStyle = COLORS.cardBg;
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  roundRect(ctx, padding / 2, padding / 2, width - padding, height - padding, 8);
  ctx.fill();
  ctx.stroke();

  let y = padding + 10;

  // Title
  if (template.title) {
    ctx.font = FONTS.title;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(template.title, padding + 10, y + 16);
    y += 40;

    // Title divider
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath();
    ctx.moveTo(padding + 10, y - 10);
    ctx.lineTo(width - padding - 10, y - 10);
    ctx.stroke();
  }

  // Sections
  for (const section of template.sections) {
    // Section title
    ctx.font = FONTS.sectionTitle;
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(section.title.toUpperCase(), padding + 10, y + 12);
    y += 24;

    if (section.layout === 'table' && section.columns) {
      // Render table
      const tableX = padding + 10;
      const tableWidth = width - padding * 2 - 20;
      const columns = section.columns;
      const colWidth = tableWidth / columns.length;

      // Table header background
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(tableX, y, tableWidth, 32);

      // Table header text
      ctx.font = FONTS.label;
      ctx.fillStyle = COLORS.textMuted;
      columns.forEach((col, colIndex) => {
        const colX = tableX + colIndex * colWidth + 8;
        ctx.fillText(col.header.toUpperCase(), colX, y + 20);
      });

      // Header border
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tableX, y + 32);
      ctx.lineTo(tableX + tableWidth, y + 32);
      ctx.stroke();

      y += 36;

      // Table rows
      const rows = section.dataKey && Array.isArray(data[section.dataKey])
        ? (data[section.dataKey] as Record<string, unknown>[])
        : [];

      if (rows.length === 0) {
        // No data message
        ctx.font = FONTS.value;
        ctx.fillStyle = COLORS.textLight;
        ctx.fillText('No data available', tableX + tableWidth / 2 - 50, y + 20);
        y += tableRowHeight;
      } else {
        ctx.lineWidth = 1;
        rows.forEach((row) => {
          // Row data
          ctx.font = FONTS.value;
          columns.forEach((col, colIndex) => {
            const colX = tableX + colIndex * colWidth + 8;
            const value = row[col.key];
            const formatted = formatColumnValue(value, col);

            ctx.fillStyle = col.highlight
              ? COLORS[col.highlight] || COLORS.text
              : COLORS.text;
            ctx.fillText(formatted, colX, y + 20);
          });

          // Row border
          ctx.strokeStyle = '#e5e7eb';
          ctx.beginPath();
          ctx.moveTo(tableX, y + tableRowHeight);
          ctx.lineTo(tableX + tableWidth, y + tableRowHeight);
          ctx.stroke();

          y += tableRowHeight;
        });
      }

      y += 16;
    } else if (section.fields && section.fields.length > 0) {
      // Render fields (grid/list)
      const cols = getColumnCount(section.layout);
      const fieldWidth = (width - padding * 2 - 20) / cols;
      const fields = section.fields;

      fields.forEach((field, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = padding + 10 + col * fieldWidth;
        const fieldY = y + row * fieldHeight;

        // Label
        ctx.font = FONTS.label;
        ctx.fillStyle = COLORS.textMuted;
        ctx.fillText(field.label.toUpperCase(), x, fieldY + 14);

        // Value
        const value = data[field.key];
        const formattedValue = formatValue(value, field);

        ctx.font = FONTS.value;
        ctx.fillStyle = field.highlight
          ? COLORS[field.highlight] || COLORS.text
          : COLORS.text;
        ctx.fillText(formattedValue + (field.unit ? ` ${field.unit}` : ''), x, fieldY + 34);
      });

      const fieldRows = Math.ceil(fields.length / cols);
      y += fieldRows * fieldHeight + 16;
    }
  }

  // Footer
  if (template.footer) {
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.textLight;
    ctx.fillText(template.footer, padding + 10, y + 10);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Render to base64 PNG string
 */
export function renderToBase64(
  template: FragmentTemplate,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): string {
  const buffer = renderToBuffer(template, data, options);
  return buffer.toString('base64');
}

/**
 * Render to data URL
 */
export function renderToDataUrl(
  template: FragmentTemplate,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): string {
  const base64 = renderToBase64(template, data, options);
  return `data:image/png;base64,${base64}`;
}

/**
 * Helper to draw rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Type for canvas context
type CanvasRenderingContext2D = ReturnType<typeof createCanvas>['getContext'] extends
  (type: '2d') => infer R ? R : never;
