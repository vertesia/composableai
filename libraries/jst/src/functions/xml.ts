import * as cheerio from 'cheerio';

/**
 * Parse xml and expose is as a cheerio object
 * @param content
 * @param options
 * @returns
 */
export function parseXml(content: string) {
    return cheerio.load(content, { xml: { decodeEntities: true, xmlMode: true } });
}
