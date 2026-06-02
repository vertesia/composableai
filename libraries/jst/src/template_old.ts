import { Script } from './script.js';

enum NodeType {
    Function,
    Variable,
    Meta,
}

function renderFunBlock(node: FunBlock, out: string[]) {
    out.push(`function ${node.signature} { return \`\\`);
    out.push(`${node.lines.join('\n')}\\`);
    out.push('`}');
}
function renderVarBlock(node: VarBlock, out: string[]) {
    out.push(`const ${node.name} = \``);
    out.push(`${node.lines.join('\n')}\\`);
    out.push('`;');
}
function renderMetaNode(node: MetaNode, out: string[]) {
    out.push(`__ctx.set("${node.key}", ${node.value});`);
}

export interface Node {
    type: NodeType;
}

export interface BlockNode extends Node {
    lines: string[];
}

export interface VarBlock extends BlockNode {
    name: string;
}

export interface FunBlock extends BlockNode {
    signature: string;
}

export interface MetaNode extends Node {
    key: string;
    value: string;
}

export class CompiledTemplate extends Script<string> {
    validate() {
        return super.validate({
            acorn: {
                allowReturnOutsideFunction: true,
                locations: true,
            },
        });
    }
}

export class Template {
    _rendered: string | null = null;

    constructor(public nodes: Node[]) {}

    compile(globals: string[] = []) {
        return new CompiledTemplate(this.render(), globals);
    }

    render() {
        if (!this._rendered) {
            this._rendered = this.renderNow();
        }
        return this._rendered;
    }

    renderNow() {
        const out: string[] = [];
        let foundTemplate = false;
        for (const node of this.nodes) {
            switch (node.type) {
                case NodeType.Variable:
                    if (!foundTemplate && (node as VarBlock).name === 'template') {
                        foundTemplate = true;
                    }
                    renderVarBlock(node as VarBlock, out);
                    break;
                case NodeType.Function:
                    renderFunBlock(node as FunBlock, out);
                    break;
                case NodeType.Meta:
                    renderMetaNode(node as MetaNode, out);
                    break;
                default:
                    throw new Error(`Unknown block type: ${node.type}`);
            }
        }
        if (!foundTemplate) {
            throw new Error('No template block found');
        }
        out.push('return template;');
        return out.join('\n');
    }

    static parse(text: string) {
        text = text.trim();
        const lines = text.split('\n');
        const linesCount = lines.length;

        let block: BlockNode | null = null;
        const nodes: Node[] = [];

        for (let i = 0; i < linesCount; i++) {
            let line = lines[i];
            if (block) {
                if (line.trim() === '```') {
                    nodes.push(block);
                    block = null;
                } else {
                    block.lines.push(line);
                }
            } else {
                // not in a block
                line = line.trim();
                if (!line || line.startsWith('//')) {
                } else if (line.startsWith('@')) {
                    const m = /^@([a-z_A-Z-]+)(?:\s+(.+))?\s*$/.exec(line);
                    if (m) {
                        const meta = { type: NodeType.Meta, key: m[1], value: m[2] } as MetaNode;
                        nodes.push(meta);
                    } else {
                        throw new Error(`Unexpected content at line ${i + 1}: ${line}`);
                    }
                } else if (line.startsWith('```')) {
                    const signature = line.substring(3).trim();
                    if (!signature) {
                        // a code block starts
                        throw new Error(`Trying to close a block at line ${i + 1}`);
                    } else if (signature.endsWith(')')) {
                        block = { type: NodeType.Function, signature, lines: [] } as FunBlock;
                    } else {
                        block = { type: NodeType.Variable, name: signature, lines: [] } as VarBlock;
                    }
                } else {
                    throw new Error(`Unexpected content at line ${i + 1}: ${line}`);
                }
            }
        }
        if (block) {
            throw new Error(`Unclosed block at line ${linesCount}`);
        }

        return new Template(nodes);
    }
}
