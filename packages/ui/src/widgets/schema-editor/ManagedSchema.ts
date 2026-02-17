import type { JSONSchema } from "@vertesia/common";
import { TypeNames, TypeSignature, parseTypeSignature } from "./type-signature.js";
import { addProperty, getTypeSignature, removeProperty, setPropertyName, setPropertyType, setRequireProperty } from "./json-schema4-utils.js";


let new_prop_name_cnt = 0;

export interface NodeUpdate {
    name?: string,
    type?: TypeSignature,
    isRequired?: boolean,
    editor?: string | null; // use null to force remove editor
    description?: string;
}

interface SchemaLoader {
    reload(): void
}

export interface SchemaSource {
    uri: string;
    name: string;
}
export class ManagedSchema implements SchemaLoader {
    // the schema source contains information about where the schema was loaded
    // the uri serves to retrieve the schema and for now only store:ID URIs are supported
    source?: SchemaSource;
    onChange: (schema: ManagedSchema) => void = () => { };
    schema: JSONSchema;
    root: SchemaNode;
    constructor(schema?: string | JSONSchema | null | undefined, title?: string) {
        if (!schema) {
            this.schema = {
                title: title,
                type: "object",
                properties: {},
            }
        } else if (typeof schema === 'string') {
            this.schema = JSON.parse(schema);
        } else {
            this.schema = schema;
        }
        if (!this.schema.properties) {
            this.schema.properties = {};
        }
        this.root = new SchemaNode("", this.schema, this);
        this.root.loadChildren();
    }

    get isEmpty() {
        return !this.root.children || this.root.children.length === 0;
    }

    get children() {
        return this.root.children!;
    }

    reload() {
        this.root = new SchemaNode("", this.schema, this);
        this.root.loadChildren();
        this.onChange?.(this);
        return this;
    }

    withSource(name: string, uri: string) {
        this.source = {
            uri,
            name
        }
        return this;
    }

    withChangeListener(cb: (schema: ManagedSchema) => void) {
        this.onChange = cb;
        return this;
    }

    replaceSchema(schema: JSONSchema | null | undefined) {
        if (!schema) {
            this.schema = {
                title: this.schema.title,
                type: "object",
                properties: {},
            }
        } else {
            this.schema = schema;
        }
        this.reload();
    }

    clone() {
        const clone = new ManagedSchema(this.schema);
        clone.source = this.source;
        if (this.onChange) {
            clone.withChangeListener(this.onChange);
        }
        return clone;
    }
}

export class SchemaNode {
    schema: JSONSchema;
    loader: SchemaLoader;
    parent?: SchemaNode;
    name: string;
    isRequired = false;
    type: TypeSignature;
    children?: SchemaNode[];

    constructor(name: string, schema: JSONSchema, loader: SchemaLoader, parent?: SchemaNode) {
        this.schema = schema;
        this.loader = loader;
        this.parent = parent;
        this.name = name;
        this.type = getTypeSignature(schema);
        if (this.parent) {
            let required = this.parent._getPropertiesSchema().required;
            this.isRequired = required && Array.isArray(required) ? required.includes(name) : false;
        }
    }

    get title() {
        return this.schema.title;
    }

    set title(value: string | undefined) {
        this.schema.title = value;
    }

    get description() {
        return this.schema.description;
    }

    set description(value: string | undefined) {
        this.schema.description = value;
    }

    get isParent() {
        return this.type.isObject;
    }

    // the isNew is a hack to preserve the open state in UI after a node is created and the tree reloaded
    get isNew() {
        return !!this.schema.isNew
    }
    set isNew(value: boolean) {
        if (value) {
            this.schema.isNew = true
        } else {
            delete this.schema.isNew
        }
    }
    resetIsNew() {
        const isNew = this.isNew;
        this.isNew = false;
        return isNew;
    }
    // end hack

    getNameSignature() {
        return `${this.name}${this.isRequired ? '' : '?'}`
    }

    getTypeSignature() {
        return `${this.type.name}${this.type.isArray ? '[]' : ''}${this.type.isNullable ? '?' : ''}`
    }

    getSignature() {
        return `${this.getNameSignature()}: ${this.getTypeSignature()}`
    }

    reloadTree() {
        this.loader.reload();
    }

    loadChildren() {
        this.children = [];
        if (this.schema.items && (this.schema.items as JSONSchema).properties) {
            this._loadChildren((this.schema.items as JSONSchema).properties!);
        } else if (this.schema.properties) {
            this._loadChildren(this.schema.properties);
        }
    }

    _loadChildren(properties: Record<string, JSONSchema>) {
        for (const name of Object.keys(properties)) {
            const childSchema = properties[name];
            const child = new SchemaNode(name, childSchema, this.loader, this);
            this.children!.push(child);
            if (child.isParent) {
                child.loadChildren();
            }
        }
    }

    _getPropertiesSchema() {
        if (this.type.isArray && this.type.isObject) {
            return this.schema.items as JSONSchema;
        } else {
            return this.schema;
        }
    }

    findAvailableChildName(prefix: string) {
        const properties = this._getPropertiesSchema().properties || {};
        let name;
        do {
            name = prefix + (++new_prop_name_cnt);
        } while (properties[name]);
        return name;
    }

    /**
     * Add a new child node
     */
    addChild(name: string, type: TypeSignature, isRequired = false) {
        if (!this.type.isObject) {
            throw new Error("Cannot add child to a non object node");
        }
        if (!this.children) {
            this.children = [];
        }
        let schema = this._getPropertiesSchema();
        const childSchema = addProperty(schema, name, type, isRequired);
        const child = new SchemaNode(name, childSchema, this.loader, this);
        this.children.push(child);
        return child;
    }

    /**
     * Remove this node
     */
    remove() {
        if (this.parent && this.parent.type.isObject) {
            const schema = this.parent._getPropertiesSchema();
            removeProperty(schema, this.name);
            if (this.parent.children) {
                this.parent.children = this.parent.children.filter(c => c.name !== this.name);
            }
            return true;
        }
        return false;
    }

    update(data: NodeUpdate) {
        let updated = false;
        if (data.name != null && this.name !== data.name) {
            if (this.parent) {
                setPropertyName(this.parent._getPropertiesSchema(), this.name, data.name)
            }
            this.name = data.name;
            updated = true;
        }
        if (data.isRequired != null && this.isRequired !== data.isRequired) {
            if (this.parent) {
                setRequireProperty(this.parent._getPropertiesSchema(), this.name, data.isRequired);
            }
            this.isRequired = data.isRequired;
            updated = true;
        }
        let actualType: string | undefined = data.type?.name;
        if (actualType === "any") {
            actualType = undefined;
        }
        const typeChanged = actualType !== this.schema.type;
        if (data.type) {
            setPropertyType(this.schema, data.type)
            this.type = data.type;
            if (this.type.isObject) {
                if (!this.children) {
                    this.children = [];
                }
            } else {
                this.children = undefined;
            }
            updated = true;
        }
        // update editor field
        if (this.schema.editor && data.editor === null) {
            // explicitly set to null => delete current editor
            this.schema.editor = undefined;
            updated = true;
        } else if (data.editor) { // a new editor is set
            this.schema.editor = data.editor;
            updated = true;
        } else if (typeChanged) {
            // preserve editor only if the type didn't change
            this.schema.editor = undefined;
            updated = true;
        }
        if (data.description !== this.description) {
            this.description = data.description;
            updated = true;
        }

        return updated;
    }

    getUpdateFromNameAndTypeSignature(nameSig: string, typeSig: string) {
        let name = nameSig.trim();
        let isRequired = true;
        if (name.endsWith('?')) {
            name = name.substring(0, name.length - 1).trim();
            isRequired = false;
        }
        const type = parseTypeSignature(typeSig) as TypeSignature;
        let editor: string | null | undefined;
        if (type.name === 'text') {
            type.name = TypeNames.string;
            editor = 'textarea'
        } else if (type.name === 'media') {
            type.name = TypeNames.any;
            editor = 'media'
        } else if (type.name === 'document') {
            type.name = TypeNames.any;
            editor = 'document'
        } else {
            editor = null; // remove custom editor
        }
        return { name, type, isRequired, editor };
    }

    updateFromNameAndTypeSignature(nameSig: string, typeSig: string) {
        return this.update(this.getUpdateFromNameAndTypeSignature(nameSig, typeSig));
    }

    updateFromSignature(text: string) {
        text = text.trim();
        const index = text.indexOf(':');
        if (index < 0) {
            throw new Error("Expecting a name and a type separated by a colon");
        }
        const nameSig = text.substring(0, index);
        const typeSig = text.substring(index + 1);
        return this.updateFromNameAndTypeSignature(nameSig, typeSig);
    }
}
