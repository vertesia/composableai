export const APPGEN_PACKAGE_SPEC_PATTERN_SOURCE =
    '^(?:latest|dev|dev-[0-9]+\\.[0-9]+|snapshot-[0-9a-f]{7}|[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)$';

export const APPGEN_PACKAGE_SPEC_PATTERN = new RegExp(APPGEN_PACKAGE_SPEC_PATTERN_SOURCE);
