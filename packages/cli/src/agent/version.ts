
export function validateVersion(version: string) {
    return /^([0-9]+)\.([0-9]+)\.([0-9]+)(-[a-zA-Z_0-9-]+)?$/.test(version);
}
