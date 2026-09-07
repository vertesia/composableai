import { useEffect, useState } from 'react';
import { ATTRIBUTE_CDATA, ATTRIBUTE_COMMENT } from '../constants';
import type { Element } from '../types';

/**
 * `fast-xml-parser` is loaded on first parse rather than at module scope.
 *
 * The parser and its builder are ~103 kB, and this module sits in the static graph of the
 * `@vertesia/ui/widgets` bundle -- one file, resolved through the consuming app's import map, that
 * `@vertesia/ui/features` imports statically. So a single symbol imported from features put the XML
 * parser into every application's first render, including the overwhelming majority that never
 * display XML. Deferring the *external* package is what moves it: an in-package dynamic import
 * would be inlined back into this bundle (see `codeSplitting: false` in rolldown.config.js).
 *
 * The promise is memoized, so only the first parse in a session waits for the module.
 */
interface XMLParserLike {
    parse(xml: string): Element[];
}

let parser: Promise<XMLParserLike> | undefined;

function loadParser(): Promise<XMLParserLike> {
    parser ??= import('fast-xml-parser').then(
        ({ XMLParser }) =>
            new XMLParser({
                preserveOrder: true,
                ignoreAttributes: false,
                attributeNamePrefix: '',
                allowBooleanAttributes: true,
                commentPropName: ATTRIBUTE_COMMENT,
                cdataPropName: ATTRIBUTE_CDATA,
                parseTagValue: false,
            }),
        (err) => {
            // Not memoized on failure: one transient chunk error would otherwise make every later
            // parse in the session fail instantly.
            parser = undefined;
            throw err;
        },
    );
    return parser;
}

export type ParsedXML =
    | { valid: true; json: Element[]; errorMessage?: undefined }
    | { valid: false; json: null; errorMessage: string };

export async function parseXML(xml: string): Promise<ParsedXML> {
    try {
        const validationDocument = new DOMParser().parseFromString(xml, 'application/xml');
        const parserError =
            validationDocument.documentElement.localName === 'parsererror'
                ? validationDocument.documentElement
                : undefined;
        if (parserError) {
            throw new Error(parserError.textContent?.trim() || 'Invalid XML!');
        }

        const json = (await loadParser()).parse(xml);

        if (xml.trim().length > 0 && json.length === 0) {
            throw new Error('Invalid XML!');
        }

        return { json, valid: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { json: null, valid: false, errorMessage: `Fail to parse: ${message}` };
    }
}

/**
 * The parse result, or `undefined` until the parser has loaded and run. Callers render nothing for
 * that first tick rather than flashing the "invalid XML" state at content that parses fine.
 */
export default function useXMLViewer(xml: string): ParsedXML | undefined {
    const [result, setResult] = useState<ParsedXML | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        setResult(undefined);
        void parseXML(xml).then((parsed) => {
            if (!cancelled) {
                setResult(parsed);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [xml]);

    return result;
}
