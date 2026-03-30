import { Env } from "@vertesia/ui/env";

const localhostDomains = new Set(["localhost", "127.0.0.1"]);

function getAuthorizedDomainsFromEnv() {
    const rawDomains = import.meta.env.VITE_FIREBASE_AUTHORIZED_DOMAINS;
    return rawDomains ? rawDomains.split(",") : [];
}

function getAuthorizedDomains() {
    let domains: string[];
    if (Env.firebase?.authorizedDomains) {
        domains = Env.firebase.authorizedDomains;
    } else {
        domains = getAuthorizedDomainsFromEnv();
    }
    return new Set(domains.map((domain: string) => domain.trim().toLowerCase()).filter(Boolean));
}

export function shouldUseFirebaseAuth(hostname = window.location.hostname) {
    const normalizedHostname = hostname.trim().toLowerCase();

    if (localhostDomains.has(normalizedHostname)) {
        return false;
    }

    return getAuthorizedDomains().has(normalizedHostname);
}

export function shouldRedirectToCentralAuth(hostname = window.location.hostname) {
    return !shouldUseFirebaseAuth(hostname);
}
