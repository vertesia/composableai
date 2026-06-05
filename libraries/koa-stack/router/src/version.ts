import type { EndpointRoute } from './router.js';
import { ServerError } from './ServerError.js';

// Threshold for switching from linear to binary search
const BINARY_SEARCH_THRESHOLD = 16;

export type VersionedEndpointRoute = Omit<EndpointRoute, 'version'> & { version: number };

export class EndpointVersions {
    private versions: VersionedEndpointRoute[] = [];
    private _sorted: boolean = false;

    get length() {
        return this.versions.length;
    }

    add(route: VersionedEndpointRoute) {
        this.versions.push(route);
        this._sorted = false;
    }

    find(version: number) {
        if (this.versions.length === 0) {
            return undefined;
        }
        if (!this._sorted) {
            this.sort();
        }
        if (this.versions.length < BINARY_SEARCH_THRESHOLD) {
            return this.versions.find((route) => route.version === version);
        } else {
            return binarySearchExact(this.versions, version);
        }
    }

    findLastVersionBefore(version: number) {
        if (this.versions.length === 0) {
            return undefined;
        }
        if (!this._sorted) {
            this.sort();
        }
        const versions = this.versions;
        if (versions.length < BINARY_SEARCH_THRESHOLD) {
            for (let i = versions.length - 1; i > -1; i--) {
                const route = versions[i];
                if (route.version <= version) {
                    return route;
                }
            }
            return undefined;
        } else {
            return binarySearchLastBefore(versions, version);
        }
    }

    sort() {
        if (this.versions.length > 1) {
            this.versions.sort((a: VersionedEndpointRoute, b: VersionedEndpointRoute) => a.version - b.version);
        }
        this._sorted = true;
    }
}

export class ApiVersion {
    version: number;
    exact: boolean = false;

    constructor(versionSpec: string) {
        if (versionSpec.startsWith('=')) {
            this.version = parseInt(versionSpec.slice(1), 10);
            this.exact = true;
        } else {
            this.version = parseInt(versionSpec, 10);
            this.exact = false;
        }
        if (this.version <= 0 || Number.isNaN(this.version)) {
            throw new ServerError(400, `Invalid version specification: ${versionSpec}`);
        }
    }

    match(defaultRoute: EndpointRoute, versions: EndpointVersions) {
        if (this.exact) {
            return versions.find(this.version);
        } else {
            const lastVersion = versions.findLastVersionBefore(this.version);
            return lastVersion || defaultRoute;
        }
    }
}

function binarySearchLastBefore(arr: VersionedEndpointRoute[], version: number): VersionedEndpointRoute | undefined {
    let low = 0;
    let high = arr.length - 1;
    let result: VersionedEndpointRoute | undefined;

    while (low <= high) {
        const mid = (low + high) >> 1;
        const midVersion = arr[mid].version;

        if (midVersion === version) {
            return arr[mid]; // exact match
        }
        if (midVersion < version) {
            result = arr[mid]; // candidate, keep searching right
            low = mid + 1;
        } else {
            high = mid - 1; // search left
        }
    }

    return result;
}

function binarySearchExact(arr: VersionedEndpointRoute[], version: number): VersionedEndpointRoute | undefined {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = (low + high) >> 1;
        const midVersion = arr[mid].version;

        if (midVersion === version) {
            return arr[mid];
        }
        if (midVersion < version) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return undefined;
}
