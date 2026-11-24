export const REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE = 'requested_scope_unavailable';
export const NO_ACCESSIBLE_ACCOUNT_ERROR_CODE = 'no_accessible_account';
export const RESTRICTED_ENVIRONMENT_ERROR_CODE = 'restricted_environment';
export const TOKEN_ISSUANCE_FORBIDDEN_ERROR_CODE = 'token_issuance_forbidden';

export const ISSUE_TOKEN_FORBIDDEN_ERROR_CODES = [
    REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
    NO_ACCESSIBLE_ACCOUNT_ERROR_CODE,
    RESTRICTED_ENVIRONMENT_ERROR_CODE,
    TOKEN_ISSUANCE_FORBIDDEN_ERROR_CODE,
] as const;

/** Stable outcomes for version upgrades; conversion-specific outcomes are reserved for future converters. */
export const TOKEN_UPGRADE_ERROR_CODES = [
    'TOKEN_REQUIRED',
    'TOKEN_INVALID',
    'TOKEN_EXPIRED',
    'TOKEN_UPGRADE_FORBIDDEN',
    'TOKEN_UPGRADE_UNSUPPORTED',
    'TOKEN_UPGRADE_NOT_POSSIBLE',
    'TOKEN_VERSION_TOO_NEW_FOR_SERVER',
    'TOKEN_UPGRADE_UNAVAILABLE',
] as const;
