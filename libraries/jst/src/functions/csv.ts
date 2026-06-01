import Papa from 'papaparse';

export function loadCsv(content: string, options: Papa.ParseConfig = {}): Papa.ParseResult<unknown> {
    return Papa.parse(content, options);
}

export function jsonToCsv(obj: unknown[] | Papa.UnparseObject<unknown>, options: Papa.UnparseConfig = {}): string {
    return Papa.unparse(obj, options);
}
