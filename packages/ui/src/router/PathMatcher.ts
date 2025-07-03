import { PathMatchParams, getPathSegments, toSegments } from "./path";

export interface PathMatch<T = any> {
    params: PathMatchParams;
    matchedSegments: string[];
    remainingSegments?: string[];
    value: T;
}

/**
 * Path matcher which support :param and *wildcard segments.
 * The wildcard segment is only supported as the last segment
 */
export class PathMatcher<T = any> {

    tree: RootSegmentNode = new RootSegmentNode();

    loadMapping(mapping: Record<string, T>) {
        for (const [key, value] of Object.entries(mapping)) {
            this.addSegments(getPathSegments(key), value);
        }
    }
    addPath(path: string, value: T) {
        this.addSegments(getPathSegments(path), value);
    }
    addSegments(segments: string[], value: T) {
        let node: ParentSegmentNode<T> = this.tree;
        for (let i = 0, l = segments.length; i < l; i++) {
            const segment = segments[i];
            if (segment[0] === ':') {
                let childNode = node.wildcard;
                if (!childNode) {
                    childNode = new VariableSegmentNode(segment);
                    node.wildcard = childNode;
                } else if (!(childNode instanceof VariableSegmentNode)) {
                    throw new Error(`Failed to index path segments: ${segments.join('/')}. A wildcard ":" segment will overwrite an existing wildcard segment at path: ${'/' + segments.slice(0, i).join("/")}`);
                }
                node = childNode as VariableSegmentNode;
            } else if (segment === '*') {
                if (node.wildcard) {
                    throw new Error(`Failed to index path segments: ${segments.join('/')}. A wildcard "*" segment already exists at path: ${'/' + segments.slice(0, i).join("/")}`);
                }
                node.wildcard = new WildcardSegmentNode(segment, value);
                if (i < l - 1) {
                    throw new Error(`Failed to index path segments: ${segments.join('/')}. A wildcard segment must be the last segment`);
                }
                return;
            } else {
                let childNode = node.children[segment];
                if (!childNode) {
                    childNode = new LiteralSegmentNode(segment);
                    node.children[segment] = childNode;
                } // else // a literal segment already exists
                node = childNode as LiteralSegmentNode;
            }
        }
        if (node.value !== undefined) {
            throw new Error(`Failed to index path segments: ${segments.join('/')}. A value already exists at path: ${'/' + segments.join("/")}`);
        }
        node.value = value;
    }

    match(path: string | string[]): PathMatch<T> | null {
        const segments = toSegments(path);
        if (segments.length === 0) {
            return null;
        }
        const params: PathMatchParams = {};
        let node: SegmentNode<T> = this.tree;
        for (const segment of segments) {
            const match = node.match(segment, params);
            if (match) {
                node = match;
            } else {
                return null;
            }
        }

        if (!node.value) { // not a leaf node (partial match)
            if (node instanceof ParentSegmentNode) {
                if (node.wildcard instanceof WildcardSegmentNode) {
                    node = node.wildcard.match('', params);
                    if (!node.value) {
                        throw new Error("Wildcard segment node `*` must have a value");
                    }
                }
            }
            if (!node.value) return null; // not a leaf node, neither a trailing wildcard (partial match)
        }
        let matchedSegments: string[], remainingSegments: string[] | undefined;
        if (params._ && params._.length > 0) {
            matchedSegments = segments.slice(0, -params._.length);
            remainingSegments = params._;
        } else {
            matchedSegments = segments;
        }
        return { params, matchedSegments, remainingSegments, value: node.value };
    }

}

interface SegmentNode<T = any> {
    name: string;
    value?: T | undefined;
    match(segment: string, params: PathMatchParams): SegmentNode<T> | null;
}
class ParentSegmentNode<T = any> implements SegmentNode<T> {
    children: Record<string, SegmentNode<T>> = {};
    wildcard?: SegmentNode<T>;

    constructor(public name: string, public value?: T | undefined) {
    }

    match(segment: string, params: PathMatchParams): SegmentNode<T> | null {
        let node = this.children[segment];
        if (node) {
            return node;
        } else if (this.wildcard) {
            if (this.wildcard instanceof WildcardSegmentNode) {
                return this.wildcard.match(segment, params);
            } else if (this.wildcard instanceof VariableSegmentNode) {
                params[this.wildcard.paramName] = segment;
                return this.wildcard;
            } else {
                throw new Error("Unknown wildcard segment node type: " + this.wildcard.constructor.name);
            }
        } else {
            return null;
        }
    }

}

class RootSegmentNode<T = any> extends ParentSegmentNode<T> {
    constructor() {
        super("#root");
    }
}

class LiteralSegmentNode<T = any> extends ParentSegmentNode<T> {
    constructor(name: string, value?: T | undefined) {
        super(name, value);
    }
}

class VariableSegmentNode<T = any> extends ParentSegmentNode<T> {
    paramName: string;
    constructor(name: string, value?: T | undefined) {
        super(name, value)
        this.paramName = name.substring(1);
    }
}

class WildcardSegmentNode<T = any> implements SegmentNode<T> {
    constructor(public name: string, public value?: T | undefined) {
    }

    match(segment: string, params: PathMatchParams) {
        if (!params._) {
            params._ = segment ? [segment] : [];
        } else {
            segment && params._.push(segment);
        }
        return this;
    }
}
