/**
 * Client constructors take a plain options object, so an option name that does not exist is not a
 * runtime error — it is silently dropped. TypeScript's excess-property check catches it for an
 * object literal, but not for a spread, an `any`, or plain JavaScript, and the resulting client
 * looks healthy right up to the first request. A credential passed under the wrong name produces a
 * client with no `Authorization` header, so every call fails with
 * `401 Unauthorized: Authorization token is required` and nothing points at the constructor.
 *
 * These helpers make that case say so, once per unknown option name.
 */

/** Options that never existed, mapped to what the caller almost certainly meant. */
const OPTION_HINTS: Record<string, string> = {
    token: 'pass the credential as `apikey`, or build the client with `VertesiaClient.fromAuthToken(token)`',
    accessToken: 'pass the credential as `apikey`, or build the client with `VertesiaClient.fromAuthToken(token)`',
    authToken: 'pass the credential as `apikey`, or build the client with `VertesiaClient.fromAuthToken(token)`',
    apiKey: 'the option is spelled `apikey`, all lowercase',
    api_key: 'the option is spelled `apikey`, all lowercase',
    appVersion: 'pin the app version with the `withAppVersion(version)` method after construction',
    apiVersion: 'pin the API version with the `withApiVersion(version)` method after construction',
    projectId: 'the project is determined by the credential; this option was never read',
    baseUrl: 'use `serverUrl` for studio and `storeUrl` for the store',
};

const warned = new Set<string>();

/**
 * Warn once per unknown option name. Deliberately a warning and not a throw: passing a harmless
 * extra key is common (spreading a wider config object) and has never failed, so throwing would
 * break working callers to report a mistake they may not have made.
 *
 * @param clientName the constructor name, used to prefix the message
 * @param opts the options object as given by the caller
 * @param known the options the constructor actually reads
 */
export function warnUnknownOptions(clientName: string, opts: object, known: Record<string, true>): void {
    // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so options named `toString`,
    // `constructor` or `valueOf` would look like known options and go unreported.
    const unknown = Object.keys(opts).filter((key) => !Object.hasOwn(known, key) && !warned.has(key));
    if (unknown.length === 0) {
        return;
    }
    for (const key of unknown) {
        warned.add(key);
    }
    const details = unknown.map((key) => (Object.hasOwn(OPTION_HINTS, key) ? `${key} (${OPTION_HINTS[key]})` : key));
    console.warn(
        `[${clientName}] Ignoring unknown constructor option(s): ${details.join('; ')}. ` +
            'Unknown options have no effect.',
    );
}

/** Test-only: forget which option names have already been reported. */
export function resetUnknownOptionWarnings(): void {
    warned.clear();
}
