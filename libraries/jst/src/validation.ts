import {
    type Function as AcornFunction,
    type ArrayPattern,
    type Identifier,
    type MemberExpression,
    type Node,
    type ObjectPattern,
    type Options,
    type Pattern,
    type Position,
    parse,
    type VariableDeclaration,
} from 'acorn';
import { base as baseV, type RecursiveVisitors, recursive as recursiveWalk } from 'acorn-walk';

const baseVisitor = baseV as Required<RecursiveVisitors<Scope>>;

const UnknownPosition = {
    line: 0,
    column: 0,
} as Position;

class ValidationError extends Error {
    constructor(
        message: string,
        public node: Node,
    ) {
        super(message);
        this.name = 'ValidationError';
    }

    get range() {
        const loc = this.node.loc;
        return loc ? [loc.start, loc.end] : [UnknownPosition, UnknownPosition];
    }

    get start() {
        return this.node.loc?.start || UnknownPosition;
    }

    get end() {
        return this.node.loc?.end || UnknownPosition;
    }

    get location() {
        if (this.node.loc) {
            return `${this.node.loc.start.line}:${this.node.loc.start.column}`;
        } else {
            return `${this.node.range}`;
        }
    }
}

export class Scope {
    readonly errors: ValidationError[];
    readonly children: Scope[] = [];
    readonly locals: Set<string> = new Set();
    constructor(
        public readonly name: string,
        public readonly node: Node,
        public readonly parent: Scope | null,
    ) {
        parent?.children.push(this);
        this.errors = parent ? parent.errors : [];
        (node as ScopedNode).$scope = this;
    }

    define(name: string) {
        this.locals.add(name);
    }

    isDefined(name: string): boolean {
        if (this.locals.has(name)) {
            return true;
        }
        if (this.parent) {
            return this.parent.isDefined(name);
        }
        return false;
    }

    pushError(message: string, node: Node) {
        this.errors.push(new ValidationError(message, node));
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    get ok() {
        return this.errors.length === 0;
    }

    print() {
        console.log(this.name, '=>', this.locals);
        for (const child of this.children) {
            child.print();
        }
    }
}

interface ScopedNode extends Node {
    $scope?: Scope;
    ___safe_identifier?: boolean;
}

function addFunctionParams(node: AcornFunction, scope: Scope) {
    for (const param of node.params) {
        if (param.type === 'Identifier') {
            scope.locals.add(param.name);
            markSafeIdentifier(param);
        } else if (param.type === 'AssignmentPattern') {
            if (param.left.type === 'Identifier') {
                scope.locals.add(param.left.name);
                markSafeIdentifier(param.left);
            }
        } else if (param.type === 'RestElement') {
            if (param.argument.type === 'Identifier') {
                scope.locals.add(param.argument.name);
                markSafeIdentifier(param.argument);
            }
        }
    }
}

function markSafeIdentifier(node: Identifier) {
    (node as ScopedNode).___safe_identifier = true;
}

function isSafeIdentifier(node: Node) {
    return !!(node as ScopedNode).___safe_identifier;
}

export interface ValidationOptions {
    globals?: string[];
    allowThis?: boolean;
    //allowClass: boolean; //TODO classes are not allowed for now
    propsBlacklist?: string[];
    acorn?: Partial<Options>;
}

const defaultAcornOpts = {
    ecmaVersion: 2020,
    sourceType: 'script',
} as Options;

export function validate(code: string, opts: ValidationOptions = {}) {
    const acornOpts: Options = opts.acorn ? { ...defaultAcornOpts, ...opts.acorn } : defaultAcornOpts;
    const program = parse(code, acornOpts);

    const root = new Scope('#root', program, null);
    if (opts.globals) {
        for (const identifier of opts.globals) {
            root.locals.add(identifier);
        }
        (program as ScopedNode).$scope = root;
    }

    const propsBlacklist = new Set(
        opts.propsBlacklist ? opts.propsBlacklist : ['constructor', 'prototype', '__proto__'],
    );

    recursiveWalk(program, root, {
        WithStatement(node, state, c) {
            state.pushError('"with" keyword is not supported', node);
            baseVisitor.WithStatement(node, state, c);
        },
        ForStatement(node, state, c) {
            state.pushError('"for" keyword is not supported', node);
            baseVisitor.ForStatement(node, state, c);
        },
        WhileStatement(node, state, c) {
            state.pushError('"while" keyword is not supported', node);
            baseVisitor.WhileStatement(node, state, c);
        },
        ImportExpression(node, state, c) {
            state.pushError('"import" keyword is not supported', node);
            baseVisitor.ImportExpression(node, state, c);
        },
        ImportDeclaration(node, state, c) {
            state.pushError('"import" keyword is not supported', node);
            baseVisitor.ImportDeclaration(node, state, c);
        },
        Class(node, state, c) {
            state.pushError('Classes are not supported', node);
            baseVisitor.Class(node, state, c);
        },
        ThisExpression(node, state, c) {
            if (!opts.allowThis) {
                state.pushError('"this" keyword is not supported', node);
            }
            baseVisitor.ThisExpression(node, state, c);
        },
        ObjectPattern(node, state, c) {
            for (const prop of (node as unknown as ObjectPattern).properties) {
                if (prop.type === 'Property') {
                    if (prop.key.type === 'Identifier') {
                        markSafeIdentifier(prop.key);
                        if (prop.kind === 'init' && propsBlacklist.has(prop.key.name)) {
                            state.pushError(`Property "${prop.key.name}" is not allowed`, prop.key);
                        }
                    }
                } else if (prop.type === 'RestElement') {
                    if (prop.argument.type === 'Identifier') {
                        markSafeIdentifier(prop.argument);
                    }
                }
            }
            baseVisitor.ObjectPattern(node, state, c);
        },
        ArrayPattern(node, state, c) {
            for (const prop of (node as unknown as ArrayPattern).elements) {
                if (prop) {
                    if (prop.type === 'Identifier') {
                        markSafeIdentifier(prop);
                        //TODO is this really needed?
                        // if (propBlacklist.has(prop.name)) {
                        //     state.pushError(`Property "${prop.name}" is not allowed`, prop);
                        // }
                    } else if (prop.type === 'RestElement') {
                        if (prop.argument.type === 'Identifier') {
                            markSafeIdentifier(prop.argument);
                        }
                    }
                }
            }
            baseVisitor.ArrayPattern(node, state, c);
        },
        MemberExpression(node, state, c) {
            const prop = (node as unknown as MemberExpression).property;
            if (prop.type === 'Identifier') {
                markSafeIdentifier(prop);
                if (propsBlacklist.has(prop.name)) {
                    state.pushError(`Property "${prop.name}" is not allowed`, prop);
                }
            } else if (prop.type === 'Literal') {
                if (propsBlacklist.has(String(prop.value))) {
                    state.pushError(`Property "${prop.value}" is not allowed`, prop);
                }
            } else {
                state.pushError('Dynamic property lookup is not supported', prop);
            }
            baseVisitor.MemberExpression(node, state, c);
        },
        Function(node: AcornFunction, state, c) {
            const name = node.id?.name;
            if (name) {
                // arrow functions have no name
                state.define(name);
            }
            const scope = new Scope(name || '#anonymous', node, state);
            addFunctionParams(node, scope);
            baseVisitor.Function(node, scope, c);
        },
        VariableDeclaration(node, state, c) {
            for (const decl of (node as unknown as VariableDeclaration).declarations) {
                if (decl.id.type === 'Identifier') {
                    markSafeIdentifier(decl.id);
                    state.define(decl.id.name);
                } else if (decl.id.type === 'ObjectPattern') {
                    //the ObjectPattern rule will call markSafeIdentifier
                    for (const prop of decl.id.properties) {
                        if (prop.type === 'Property') {
                            if (prop.value.type === 'Identifier') state.define(prop.value.name);
                        } else if (prop.type === 'RestElement') {
                            if (prop.argument.type === 'Identifier') state.define(prop.argument.name);
                        }
                    }
                } else if (decl.id.type === 'ArrayPattern') {
                    //the ArrayPattern rule will call markSafeIdentifier
                    for (const prop of decl.id.elements as Pattern[]) {
                        if (prop.type === 'Identifier') {
                            state.define(prop.name);
                        } else if (prop.type === 'RestElement') {
                            if (prop.argument.type === 'Identifier') state.define(prop.argument.name);
                        }
                    }
                }
            }
            baseVisitor.VariableDeclaration(node, state, c);
        },
    } as RecursiveVisitors<Scope>);

    recursiveWalk(program, root, {
        Function(node: AcornFunction, state, c) {
            baseVisitor.Function(node, (node as ScopedNode).$scope || state, c);
        },
        Identifier(node, state, c) {
            const identifier = node as unknown as Identifier;
            if (!isSafeIdentifier(node) && !state.isDefined(identifier.name)) {
                state.pushError(`Unknown identifier "${identifier.name}"`, node);
            }
            baseVisitor.Identifier(node, state, c);
        },
    } as RecursiveVisitors<Scope>);

    return root;
}

export class CompositeError extends Error {
    constructor(
        public errors: Error[],
        message?: string,
    ) {
        super(`${message || 'Composite Error'}\n${errors.map((err) => err.message).join('\n* ')}`);
        this.errors = errors;
        this.name = 'CompositeError';
    }
}
