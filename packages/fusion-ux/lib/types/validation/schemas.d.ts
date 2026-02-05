/**
 * JSON Schemas for template validation using AJV
 */
import type { JSONSchemaType } from 'ajv';
import type { FieldTemplate, SectionTemplate, FragmentTemplate, ColumnTemplate } from '../types.js';
/**
 * Schema for a single field template
 */
export declare const FieldTemplateSchema: JSONSchemaType<FieldTemplate>;
/**
 * Schema for a table column template
 */
export declare const ColumnTemplateSchema: JSONSchemaType<ColumnTemplate>;
/**
 * Schema for Vega-Lite spec (flexible - allows any valid Vega-Lite properties)
 * We validate structure loosely and let Vega-Lite handle detailed validation
 * Note: Using loose typing since VegaLiteSpec is intentionally flexible
 */
export declare const VegaLiteSpecSchema: {
    type: "object";
    additionalProperties: boolean;
};
/**
 * Schema for chart template
 * Note: Using loose typing for spec since VegaLiteSpec is flexible
 */
export declare const ChartTemplateSchema: {
    type: "object";
    properties: {
        title: {
            type: "string";
            nullable: boolean;
        };
        description: {
            type: "string";
            nullable: boolean;
        };
        spec: {
            type: "object";
            additionalProperties: boolean;
        };
        height: {
            type: "number";
            nullable: boolean;
        };
        width: {
            type: "number";
            nullable: boolean;
        };
        dataKey: {
            type: "string";
            nullable: boolean;
        };
    };
    required: readonly ["spec"];
    additionalProperties: boolean;
};
/**
 * Schema for a section template
 * Note: Using type assertion due to ChartTemplate's flexible VegaLiteSpec
 */
export declare const SectionTemplateSchema: JSONSchemaType<SectionTemplate>;
/**
 * Schema for the root fragment template
 */
export declare const FragmentTemplateSchema: JSONSchemaType<FragmentTemplate>;
//# sourceMappingURL=schemas.d.ts.map