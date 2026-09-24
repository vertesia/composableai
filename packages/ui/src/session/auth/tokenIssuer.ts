/** Classify legacy STS credentials for routing; API servers still verify their signatures and grants. */
export function isStsTokenIssuer(issuer: string | undefined, stsEndpoint: string): boolean {
    if (!issuer) return false;
    const normalized = issuer.replace(/\/+$/, '');
    if (normalized === stsEndpoint.replace(/\/+$/, '')) return true;
    try {
        const endpoint = new URL(stsEndpoint);
        // Branch STS uses a separate OAuth issuer but retains the regional issuer for legacy
        // /token/issue and /token/sign credentials (including workload identity consumers).
        const branch = /^token-server-dev-[a-z0-9-]+\.api\.(dev1|dev2)\.vertesia\.io$/.exec(endpoint.hostname);
        return Boolean(
            branch &&
                endpoint.protocol === 'https:' &&
                !endpoint.port &&
                !endpoint.username &&
                !endpoint.password &&
                endpoint.pathname === '/' &&
                !endpoint.search &&
                !endpoint.hash &&
                normalized === `https://sts.${branch[1]}.vertesia.io`,
        );
    } catch {
        return false;
    }
}
