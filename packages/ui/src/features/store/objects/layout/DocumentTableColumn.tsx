import React from 'react';

import { ColumnLayout, ContentObjectItem } from '@vertesia/common';

import renderers from './renderers';

const defaultRenderer = renderers.string();

function resolveField(object: ContentObjectItem, path: string[]) {
    let p = object as any;
    if (!p) return undefined;
    if (!path.length) return p;
    const last = path.length - 1;
    for (let i = 0; i < last; i++) {
        p = p[path[i]];
        if (!p) {
            return undefined;
        }
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
    renderer: (value: any, index: number) => React.ReactNode = defaultRenderer;
    path: string[];
    fallbackPath?: string[];
    constructor(public layout: ExtendedColumnLayout) {
        this.path = splitPath(layout.field || '');
        this.fallbackPath = layout.fallback ? splitPath(layout.fallback) : undefined;

        // If there's a custom render function, use it
        if (layout.render) {
            this.renderer = (_value: any, _index: number) => null; // Placeholder, we'll use render directly
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
            return <td key={index} className="whitespace-nowrap px-3 py-4 text-sm">{this.layout.render(object)}</td>;
        }
        // Otherwise use the type-based renderer with the resolved value
        return this.renderer(this.resolveValue(object), index);
    }
}
