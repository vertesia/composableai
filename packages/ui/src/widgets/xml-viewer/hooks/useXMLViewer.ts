import { XMLParser } from 'fast-xml-parser';
import { useMemo } from 'react';
import { ATTRIBUTE_CDATA, ATTRIBUTE_COMMENT } from '../constants';

const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
    commentPropName: ATTRIBUTE_COMMENT,
    cdataPropName: ATTRIBUTE_CDATA,
    parseTagValue: false,
});

export function parseXML(xml: string) {
    try {
        const validationDocument = new DOMParser().parseFromString(xml, 'application/xml');
        const parserError =
            validationDocument.documentElement.localName === 'parsererror'
                ? validationDocument.documentElement
                : undefined;
        if (parserError) {
            throw new Error(parserError.textContent?.trim() || 'Invalid XML!');
        }

        const json = parser.parse(xml);

        if (xml.trim().length > 0 && json.length === 0) {
            throw new Error('Invalid XML!');
        }

        return { json, valid: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { json: null, valid: false, errorMessage: `Fail to parse: ${message}` };
    }
}

export default function useXMLViewer(xml: string) {
    return useMemo(() => parseXML(xml), [xml]);
}
