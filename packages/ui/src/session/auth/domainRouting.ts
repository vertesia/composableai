import { Env } from "@vertesia/ui/env";

const localhostDomains = new Set(["localhost", "127.0.0.1"]);

function getAuthorizedDomains() {
    const domains = Env.firebase?.authorizedDomains ?? [];
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
