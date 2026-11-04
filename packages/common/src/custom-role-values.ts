/** Custom definitions are account-local; only references carry this prefix. */
export const CUSTOM_ROLE_PREFIX = 'c:';
export const CUSTOM_ROLE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export const CUSTOM_ROLE_NAME_MAX_LENGTH = 64;

export function isCustomRoleName(name: string): boolean {
    return name.startsWith(CUSTOM_ROLE_PREFIX);
}

export function isCustomRoleReference(name: string): boolean {
    const unprefixed = name.slice(CUSTOM_ROLE_PREFIX.length);
    return (
        isCustomRoleName(name) &&
        unprefixed.length <= CUSTOM_ROLE_NAME_MAX_LENGTH &&
        CUSTOM_ROLE_NAME_PATTERN.test(unprefixed)
    );
}
