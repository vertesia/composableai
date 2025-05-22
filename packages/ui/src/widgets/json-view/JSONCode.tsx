
import { ObjectKey, ObjectVisitor, ObjectWalker } from "@vertesia/json";
import { useEffect, useState } from "react";

const st_code = "bg-gray-100 dark:bg-slate-800 whitespace-pre-wrap p-4 rounded-lg font-mono";
const st_punct = "text-pink-500 dark:text-pink-400";
const st_symbol = "text-purple-500 dark:text-purple-400";
const st_number = "text-green-500 dark:text-green-400";
const st_string = "text-orange-500 dark:text-orange-400";
const st_key = "text-blue-500 dark:text-blue-400";

interface JsonCodeClassMap {
    code: string,
    comma: string,
    assign: string,
    startObject: string,
    endObject: string,
    startArray: string,
    endArray: string,
    boolean: string,
    null: string,
    key: string,
    index: string,
    string: string,
    number: string,
}

const defaultClassMap: JsonCodeClassMap = {
    code: st_code,
    comma: st_punct,
    assign: st_punct,
    startObject: st_punct,
    endObject: st_punct,
    startArray: st_punct,
    endArray: st_punct,
    boolean: st_symbol,
    null: st_symbol,
    key: st_key,
    index: st_key,
    string: st_string,
    number: st_number,
}

abstract class Block {
    result: string[] = [];

    constructor(public renderer: JsonRenderer, public parent: Block | undefined, public key: ObjectKey, public indent: string) {
    }

    get classMap() {
        return this.renderer.classMap;
    }

    writeKey(key: ObjectKey) {
        const type = typeof key;
        if (type === 'string') {
            if (this.result.length > 0) {
                this.result.push(`<span class='${this.classMap.comma}'>,\n</span>`);
            }
            this.indent && this.result.push(this.indent);
            this.result.push(`<span class="${this.classMap.key}">"${key}"</span><span class='${this.classMap.assign}'>: </span>`);
        } else if (type === 'number') {
            if (this.result.length > 0) {
                this.result.push(`<span class='${this.classMap.comma}'>,\n</span>`);
            }
            this.indent && this.result.push(this.indent);
        }
    }
    pushValue(key: ObjectKey, value: any) {
        this.writeKey(key);
        if (value === null) {
            this.result.push(`<span class='${this.classMap.null}'>null</span>`);
        } else if (value instanceof Block) {
            this.result.push(value.renderStart() + value.renderValue() + value.renderEnd());
        } else {
            let valueClass;
            const type = typeof value;
            if (type === 'string') {
                value = `"${value}"`;
                value = value.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                valueClass = this.classMap.string;
            } else if (type === 'number') {
                valueClass = this.classMap.number;
            } else if (type === 'boolean') {
                valueClass = this.classMap.boolean;
            }
            this.result.push(`<span class='${valueClass}'>${value}</span>`);
        }
    }
    renderValue() {
        return this.result.join('');
    }
    abstract renderStart(): string;
    abstract renderEnd(): string;
}

class ObjectBlock extends Block {
    constructor(renderer: JsonRenderer, parent: Block | undefined, key: ObjectKey, indent: string) {
        super(renderer, parent, key, indent);
    }
    renderStart() {
        return `<span class='${this.classMap.startObject}'>{\n</span>`;
    }
    renderEnd() {
        const NL = this.result.length > 0 ? '\n' : '';
        return `<span class='${this.classMap.endObject}'>${NL}${this.parent?.indent || ''}}</span>`;
    }
}

class ArrayBlock extends Block {

    constructor(renderer: JsonRenderer, parent: Block | undefined, key: ObjectKey, indent: string) {
        super(renderer, parent, key, indent);
    }
    renderStart() {
        return `<span class='${this.classMap.startArray}'>[\n</span>`;
    }
    renderEnd() {
        const NL = this.result.length > 0 ? '\n' : '';
        return `<span class='${this.classMap.endArray}'>${NL}${this.parent?.indent || ''}]</span>`;
    }
}

class JsonRenderer implements ObjectVisitor {
    stack: Block[] = [];
    block: Block = new ObjectBlock(this, undefined, '', '');

    constructor(public classMap: JsonCodeClassMap = defaultClassMap, public tab = '  ') {
    }


    onStartObject(key: ObjectKey) {
        const nested = new ObjectBlock(this, this.block, key, this.block.indent + this.tab);
        this.stack.push(this.block);
        this.block = nested;
    }

    onEndObject() {
        const currentBlock = this.block;
        this.block = this.stack.pop()!;
        this.block.pushValue(currentBlock.key, currentBlock);
    }

    onStartIteration(key: ObjectKey) {
        const nested = new ArrayBlock(this, this.block, key, this.block.indent + this.tab);
        this.stack.push(this.block);
        this.block = nested;
    }

    onEndIteration() {
        const currentBlock = this.block;
        this.block = this.stack.pop()!;
        this.block.pushValue(currentBlock.key, currentBlock);
    }

    onValue(key: ObjectKey, value: any) {
        this.block.pushValue(key, value);
    }
}

function renderJson(json: any, classMap?: JsonCodeClassMap, className?: string) {
    const renderer = new JsonRenderer(classMap);
    new ObjectWalker().walk(json, renderer);
    const out = renderer.block.renderValue();
    return <div className={className} dangerouslySetInnerHTML={{ __html: `<div class='${renderer.classMap.code}' style='overflow-x: scroll'>${out}</div>` }} />
}

export function JSONCode({ data, className, classMap }: { data: any; className?: string, classMap?: JsonCodeClassMap }) {
    const [element, setElement] = useState<React.ReactElement>();
    useEffect(() => {
        setElement(renderJson(data, classMap, className));
    }, [data]);
    return element;
}
