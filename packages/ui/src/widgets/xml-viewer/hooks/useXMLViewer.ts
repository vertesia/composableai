import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
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

export default function useXMLViewer(xml: string) {
    return useMemo(() => {
        try {
            const validationResult = SyntaxValidator.validate(xml);
            if (validationResult !== true) {
                throw new Error(validationResult.err.msg || 'Invalid XML!');
            }

            const json = parser.parse(xml);

            if (typeof xml === 'string' && xml.trim().length > 0 && json.length === 0) {
                throw new Error('Invalid XML!');
            }

            return { json, valid: true };
        } catch (e) {
            const error = e as Error;
            return { json: null, valid: false, errorMessage: `Fail to parse: ${error.message}` };
        }
    }, [xml]);
}
