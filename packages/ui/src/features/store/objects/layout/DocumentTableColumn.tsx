import type { ColumnLayout, ContentObjectItem } from '@vertesia/common';
import type React from 'react';

import { DocumentCellActions } from '../DocumentQuickFilter';
import renderers from './renderers';

const defaultRenderer = renderers.string();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function resolveField(object: ContentObjectItem, path: string[]) {
    let p = object as unknown;
    if (!p) return undefined;
    if (!path.length) return p;
    const last = path.length - 1;
    for (let i = 0; i < last; i++) {
        if (!isRecord(p)) {
            return undefined;
        }
        p = p[path[i]];
        if (!p) {
            return undefined;
        }
    }
    if (!isRecord(p)) {
        return undefined;
    }
    return p[path[last]];
}

function splitPath(path: string) {
    if (!path || path === '.') {
        return [];
    }
    return path.split('.');
}

// Extend the ColumnLayout type to include our custom render function
export interface ExtendedColumnLayout extends Omit<ColumnLayout, 'field'> {
    field?: string;
    render?: (item: ContentObjectItem) => React.ReactNode;
}

export class DocumentTableColumn {
    renderer: (value: unknown, index: number, actions?: React.ReactNode) => React.ReactNode = defaultRenderer;
    path: string[];
    fallbackPath?: string[];
    previewObject?: (objectId: string) => void;
    constructor(
        public layout: ExtendedColumnLayout,
        previewObject?: (objectId: string) => void,
    ) {
        this.path = splitPath(layout.field || '');
        this.fallbackPath = layout.fallback ? splitPath(layout.fallback) : undefined;
        this.previewObject = previewObject;

        // If there's a custom render function, use it
        if (layout.render) {
            this.renderer = (_value: unknown, _index: number) => null; // Placeholder, we'll use render directly
        } else {
            // Otherwise use the type-based renderer
            const type = layout.type || 'string';
            const i = type.indexOf('?');
            if (i > 0) {
                const name = type.substring(0, i);
                const params = new URLSearchParams(type.substring(i + 1));
                this.renderer = renderers[name](params);
            } else {
                this.renderer = renderers[type]();
            }
        }
    }

    get name() {
        return this.layout.name;
    }

    resolveValue(object: ContentObjectItem) {
        let value = resolveField(object, this.path);
        if (value === undefined && this.fallbackPath) {
            value = resolveField(object, this.fallbackPath);
        }
        if (value === undefined) {
            value = this.layout.default;
        }
        return value;
    }

    render(object: ContentObjectItem, index: number) {
        // If there's a custom render function, wrap its result in a td
        if (this.layout.render) {
            return (
                <td key={index} className="whitespace-nowrap px-3 py-4 text-sm group">
                    {this.layout.render(object)}
                </td>
            );
        }

        const type = this.layout.type || 'string';
        const baseType = type.indexOf('?') > 0 ? type.substring(0, type.indexOf('?')) : type;
        const actions = this.buildActions(object, baseType);

        if ((baseType === 'objectId' || baseType === 'objectLink') && this.previewObject) {
            const i = type.indexOf('?');
            const params = i > 0 ? new URLSearchParams(type.substring(i + 1)) : undefined;
            const renderer = renderers[baseType](params, (_id: string) => {
                this.previewObject?.(object.id);
            });
            return renderer(object, index, actions);
        }

        // Otherwise use the type-based renderer with the resolved value
        return this.renderer(this.resolveValue(object), index, actions);
    }

    /**
     * Per-cell quick-filter/copy actions, derived from the column's field/type. Returns undefined for
     * columns that aren't backed by a filterable facet field. The filter handler itself is read from
     * {@link DocumentQuickFilterProvider} context by {@link DocumentCellActions}.
     */
    private buildActions(object: ContentObjectItem, baseType: string): React.ReactNode {
        const field = this.layout.field;
        if (baseType === 'objectId' || baseType === 'objectLink' || field === 'id') {
            return <DocumentCellActions field="id" value={object.id} label={object.id} copyContent={object.id} />;
        }
        if (baseType === 'objectName' || field === 'name') {
            return <DocumentCellActions field="name" value={object.name} label={object.name ?? object.id} />;
        }
        if (baseType === 'typeLink' || field === 'type.name' || field === 'type') {
            const typeId = object.type?.id;
            return <DocumentCellActions field="type" value={typeId} label={object.type?.name ?? typeId ?? 'type'} />;
        }
        if (field === 'status') {
            return <DocumentCellActions field="status" value={object.status} label={object.status} />;
        }
        return undefined;
    }
}
