export type OAuthScope = 'openid' | 'profile' | 'mcp' | 'a2a';

export const DEFAULT_OAUTH_SCOPES: readonly OAuthScope[] = ['openid', 'profile', 'mcp', 'a2a'];
