export const REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE = 'requested_scope_unavailable';
export const NO_ACCESSIBLE_ACCOUNT_ERROR_CODE = 'no_accessible_account';
export const RESTRICTED_ENVIRONMENT_ERROR_CODE = 'restricted_environment';

export const ISSUE_TOKEN_FORBIDDEN_ERROR_CODES = [
    REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
    NO_ACCESSIBLE_ACCOUNT_ERROR_CODE,
    RESTRICTED_ENVIRONMENT_ERROR_CODE,
] as const;

export type IssueTokenForbiddenErrorCode = (typeof ISSUE_TOKEN_FORBIDDEN_ERROR_CODES)[number];
