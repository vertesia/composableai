/**
 * JSON Schemas for template validation using AJV
 */

import type { JSONSchemaType } from 'ajv';
import type { FieldTemplate, SectionTemplate, FragmentTemplate, ColumnTemplate } from '../types.js';

/**
 * Schema for field options (select dropdowns)
 */
const FieldOptionSchema = {
  type: 'object' as const,
  properties: {
    label: { type: 'string' as const },
    value: { type: 'string' as const }
  },
  required: ['label', 'value'] as const,
  additionalProperties: false
};

/**
 * Schema for a single field template
 */
export const FieldTemplateSchema: JSONSchemaType<FieldTemplate> = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    key: { type: 'string' },
    format: {
      type: 'string',
      enum: ['text', 'number', 'currency', 'percent', 'date', 'boolean'],
      nullable: true
    },
    unit: { type: 'string', nullable: true },
    editable: { type: 'boolean', nullable: true },
    inputType: {
      type: 'string',
      enum: ['text', 'number', 'date', 'select', 'checkbox'],
      nullable: true
    },
    options: {
      type: 'array',
      items: FieldOptionSchema,
      nullable: true
    },
    min: { type: 'number', nullable: true },
    max: { type: 'number', nullable: true },
    highlight: {
      type: 'string',
      enum: ['success', 'warning', 'error', 'info'],
      nullable: true
    },
    tooltip: { type: 'string', nullable: true },
    decimals: { type: 'number', nullable: true },
    currency: { type: 'string', nullable: true }
  },
  required: ['label', 'key'],
  additionalProperties: false
};

/**
 * Schema for a table column template
 */
export const ColumnTemplateSchema: JSONSchemaType<ColumnTemplate> = {
  type: 'object',
  properties: {
    header: { type: 'string' },
    key: { type: 'string' },
    format: {
      type: 'string',
      enum: ['text', 'number', 'currency', 'percent', 'date', 'boolean'],
      nullable: true
    },
    width: { type: 'string', nullable: true },
    align: {
      type: 'string',
      enum: ['left', 'center', 'right'],
      nullable: true
    },
    currency: { type: 'string', nullable: true },
    decimals: { type: 'number', nullable: true },
    highlight: {
      type: 'string',
      enum: ['success', 'warning', 'error', 'info'],
      nullable: true
    }
  },
  required: ['header', 'key'],
  additionalProperties: false
};

/**
 * Schema for Vega-Lite spec (flexible - allows any valid Vega-Lite properties)
 * We validate structure loosely and let Vega-Lite handle detailed validation
 * Note: Using loose typing since VegaLiteSpec is intentionally flexible
 */
export const VegaLiteSpecSchema = {
  type: 'object' as const,
  additionalProperties: true, // Allow any Vega-Lite properties
  // We don't enforce specific properties since Vega-Lite has many valid forms
};

/**
 * Schema for chart template
 * Note: Using loose typing for spec since VegaLiteSpec is flexible
 */
export const ChartTemplateSchema = {
  type: 'object' as const,
  properties: {
    title: { type: 'string' as const, nullable: true },
    description: { type: 'string' as const, nullable: true },
    spec: VegaLiteSpecSchema,
    height: { type: 'number' as const, nullable: true },
    width: { type: 'number' as const, nullable: true },
    dataKey: { type: 'string' as const, nullable: true }
  },
  required: ['spec'] as const,
  additionalProperties: false
};

/**
 * Schema for a section template
 * Note: Using type assertion due to ChartTemplate's flexible VegaLiteSpec
 */
export const SectionTemplateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    layout: {
      type: 'string',
      enum: ['grid-2', 'grid-3', 'grid-4', 'list', 'table', 'chart'],
      nullable: true
    },
    collapsed: { type: 'boolean', nullable: true },
    fields: {
      type: 'array',
      items: FieldTemplateSchema,
      nullable: true
    },
    columns: {
      type: 'array',
      items: ColumnTemplateSchema,
      nullable: true
    },
    dataKey: { type: 'string', nullable: true },
    chart: {
      ...ChartTemplateSchema,
      nullable: true
    }
  },
  required: ['title'],
  additionalProperties: false
} as JSONSchemaType<SectionTemplate>;

/**
 * Schema for the root fragment template
 */
export const FragmentTemplateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', nullable: true },
    entityType: {
      type: 'string',
      enum: ['fund', 'scenario', 'portfolio', 'transaction', 'custom'],
      nullable: true
    },
    sections: {
      type: 'array',
      items: SectionTemplateSchema
    },
    footer: { type: 'string', nullable: true }
  },
  required: ['sections'],
  additionalProperties: false
} as JSONSchemaType<FragmentTemplate>;
