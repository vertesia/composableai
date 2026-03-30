const firebaseAuthDomains = new Set([
    "cloud.vertesia.io",
    "preview.cloud.vertesia.io",
]);

const firebaseAuthDomainPatterns = [
    /^cloud\.[a-z0-9-]+\.vertesia\.io$/,
    /^preview\.[a-z0-9-]+\.vertesia\.io$/,
    /^[a-z0-9-]+\.cloud\.[a-z0-9-]+\.vertesia\.io$/,
];

const localhostDomains = new Set(["localhost", "127.0.0.1"]);

export function shouldUseFirebaseAuth(hostname = window.location.hostname) {
    if (localhostDomains.has(hostname)) {
        return false;
    }

    if (firebaseAuthDomains.has(hostname)) {
        return true;
    }

    return firebaseAuthDomainPatterns.some((pattern) => pattern.test(hostname));
}

export function shouldRedirectToCentralAuth(hostname = window.location.hostname) {
    return !shouldUseFirebaseAuth(hostname);
}
