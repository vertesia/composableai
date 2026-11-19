import packageMetadata from '../package.json' with { type: 'json' };

/** Product token every Vertesia SDK sends first in its User-Agent: `vertesia-client-<language>/<version>`. */
export const CLIENT_USER_AGENT_PRODUCT = `vertesia-client-ts/${packageMetadata.version}`;

/**
 * The server-side JavaScript runtime, as `<name>/<version>`, or undefined in a browser.
 */
function serverRuntime(): string | undefined {
    const runtime = globalThis as typeof globalThis & {
        Deno?: { version?: { deno?: string } };
        process?: { versions?: { bun?: string; node?: string } };
        window?: unknown;
    };
    if (typeof runtime.window !== 'undefined') {
        return undefined;
    }
    const versions = runtime.process?.versions;
    if (typeof versions?.bun === 'string') {
        return `bun/${versions.bun}`;
    }
    if (typeof runtime.Deno?.version?.deno === 'string') {
        return `deno/${runtime.Deno.version.deno}`;
    }
    if (typeof versions?.node === 'string') {
        return `node/${versions.node}`;
    }
    return undefined;
}

/**
 * The User-Agent header identifying this SDK and its version, e.g.
 * `vertesia-client-ts/1.7.0 node/22.11.0`.
 *
 * Empty in a browser: the browser owns its User-Agent, and any other custom header would add a
 * CORS preflight requirement that servers on an older release do not allow.
 */
export function clientUserAgentHeaders(): Record<string, string> {
    const runtime = serverRuntime();
    return runtime ? { 'user-agent': `${CLIENT_USER_AGENT_PRODUCT} ${runtime}` } : {};
}
