import { JSONSchema, JSONSchemaType, JSONSchemaTypeName } from "@vertesia/common";
import Ajv, { ValidateFunction } from "ajv";

function createSchemaFromType(type: JSONSchemaTypeName): JSONSchema {
    if (type === 'object') {
        return { type: 'object', properties: {} };
    } else if (type === 'array') {
        return { type: 'array', items: { type: 'any' } };
    } else {
        return { type };
    }
}

export class Schema {
    schema: JSONSchema;
    properties: Record<string, PropertySchema> = {};
    validator: ValidateFunction;
    constructor(schema?: JSONSchema) {
        this.schema = schema || { type: 'object', properties: {} };
        this.validator = new Ajv({ strict: false }).compile(this.schema);
        this.load();
    }

    private load() {
        if (this.schema.properties) {
            const properties = this.schema.properties;
            Object.keys(properties).forEach(name => {
                this.loadProperty(name, properties[name]);
            });
        }
    }

    hasProperties() {
        return Object.keys(this.properties).length > 0;
    }

    get title() {
        return this.schema.title || this.schema.name;
    }

    get description() {
        return this.schema.description;
    }

    private loadProperty(name: string, propertySchema: JSONSchema) {
        let property: PropertySchema;
        if (propertySchema.type === 'array') {
            property = new ArrayPropertySchema(this, name, propertySchema);
        } else {
            property = new PropertySchema(this, name, propertySchema);
        }
        this.properties[name] = property;
        return property;
    }

    get type() {
        return this.schema.type as JSONSchemaTypeName;
    }

    validate(value: any) {
        if (!this.validator(value)) {
            return this.validator.errors || [];
        } else {
            return true;
        }
    }

    addProperty(name: string, typeOrSchema: JSONSchemaTypeName | JSONSchema, isRequired = false) {
        if (this.schema.type !== 'object') {
            this.schema.type = 'object';
        }
        if (!this.schema.properties) {
            this.schema.properties = {};
        }
        const propertySchema = typeof typeOrSchema === 'string' ? createSchemaFromType(typeOrSchema) : typeOrSchema;
        const property = this.loadProperty(name, propertySchema);
        this.schema.properties[property.name] = property.schema;
        if (isRequired) {
            property.isRequired = true;
        }
        return property;
    }

    removeProperty(name: string) {
        if (this.schema.properties) {
            delete this.schema.properties[name];
            if (Array.isArray(this.schema.required)) {
                this.schema.required = this.schema.required.filter(x => x !== name);
            }
        }
        delete this.properties[name];
    }

    getProperty(name: string) {
        return this.properties[name];
    }

    get editor() {
        return this.schema.editor;
    }
}

export class PropertySchema extends Schema {
    constructor(public parent: Schema, public name: string, schema: JSONSchema) {
        super(schema);
        if (schema.type === 'array') {
            throw new Error("Array property must be instantiated using ArrayPropertySchema");
        }
        if (schema.type === 'object' && !schema.properties) {
            schema.properties = {};
        }
    }

    get isMulti() {
        return false;
    }

    get isReadOnly() {
        return !!this.schema.readOnly;
    }

    set isReadOnly(value: boolean) {
        this.schema.readOnly = value;
    }

    get defaultValue() {
        return this.schema.default;
    }

    set defaultValue(value: JSONSchemaType | undefined) {
        this.schema.default = value;
    }

    get enum() {
        return this.schema.enum;
    }

    set enum(values: JSONSchemaType[] | undefined) {
        this.schema.enum = values;
    }

    get isRequired() {
        const required = this.parent.schema.required as string[] | undefined;
        return required ? required.includes(this.name) : false;
    }

    set isRequired(value: boolean) {
        let required = Array.isArray(this.parent.schema.required) ? this.parent.schema.required : [];
        if (value) {
            required = required.concat(this.name);
        } else {
            required = required.filter(x => x !== this.name);
        }
        this.parent.schema.required = required;
    }

    get type() {
        return this.schema.type as JSONSchemaTypeName;
    }

    set type(value: JSONSchemaTypeName) {
        if (this.schema.type !== value) {
            this.schema.type = value;
            if (value !== 'object') { // remove sub properties
                this.properties = {};
                this.schema.properties = undefined;
            }
        }
    }

    remove() {
        this.parent.removeProperty(this.name);
    }

    get isBoolean() {
        return this.type === 'boolean';
    }

    get isString() {
        return this.type === 'string';
    }

    get isNumber() {
        return this.type === 'number' || this.type === 'integer';
    }

    get isObject() {
        return this.type === 'object';
    }
}

function getArrayElementType(schema: JSONSchema) {
    if (schema.type !== 'array') {
        throw new Error('Expecting an array schema');
    }
    if (!schema.items) {
        schema.items = { type: 'any' };
    } else if (Array.isArray(schema.items)) {
        throw new Error('Tuple arrays are not supported');
    }
    return schema.items as JSONSchema;
}

export class ArrayPropertySchema extends PropertySchema {
    arraySchema: JSONSchema;
    constructor(parent: Schema, name: string, schema: JSONSchema) {
        super(parent, name, getArrayElementType(schema));
        this.arraySchema = schema;
    }

    get isMulti() {
        return true;
    }

}
