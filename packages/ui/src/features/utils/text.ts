export function shortId(id: string, length: number = 7) {
    if (!id) {
        return "";
    }
    return "~" + id.slice(-length);
}

export function shortenString(str: string, length: number) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}