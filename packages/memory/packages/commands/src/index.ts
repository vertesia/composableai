import type { Commands } from "@becomposable/memory";
import { build, getBuilder } from "./build.js";


function vars(): ReturnType<Commands['vars']> {
    return getBuilder().vars();
}

function tmpdir(): ReturnType<Commands['tmpdir']> {
    return getBuilder().tmpdir();
}

function from(...args: Parameters<Commands['from']>): ReturnType<Commands['from']> {
    return getBuilder().from(...args);
}

function exec(...args: Parameters<Commands['exec']>): ReturnType<Commands['exec']> {
    return getBuilder().exec(...args);
}

function copy(...args: Parameters<Commands['copy']>): ReturnType<Commands['copy']> {
    return getBuilder().copy(...args);
}

function copyText(...args: Parameters<Commands['copyText']>): ReturnType<Commands['copyText']> {
    return getBuilder().copyText(...args);
}

function content(...args: Parameters<Commands['content']>): ReturnType<Commands['content']> {
    return getBuilder().content(...args);
}

function json(...args: Parameters<Commands['json']>): ReturnType<Commands['json']> {
    return getBuilder().json(...args);
}

function pdf(...args: Parameters<Commands['pdf']>): ReturnType<Commands['pdf']> {
    return getBuilder().pdf(...args);
}

function docx(...args: Parameters<Commands['docx']>): ReturnType<Commands['docx']> {
    return getBuilder().docx(...args);
}

function media(...args: Parameters<Commands['media']>): ReturnType<Commands['media']> {
    return getBuilder().media(...args);
}

export {
    build, content, copy, copyText, docx, exec, from, getBuilder, json, media, pdf, tmpdir, vars
};
