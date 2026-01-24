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
 * Schema for a section template
 */
export const SectionTemplateSchema: JSONSchemaType<SectionTemplate> = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    layout: {
      type: 'string',
      enum: ['grid-2', 'grid-3', 'grid-4', 'list', 'table'],
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
    dataKey: { type: 'string', nullable: true }
  },
  required: ['title'],
  additionalProperties: false
};

/**
 * Schema for the root fragment template
 */
export const FragmentTemplateSchema: JSONSchemaType<FragmentTemplate> = {
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
};
