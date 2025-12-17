import { vi, type VitestUtils } from "vitest";
import createFetchMock, { type FetchMock } from "vitest-fetch-mock";

declare global {
    var vi: VitestUtils;
    var fetchMock: FetchMock;
}

// Create and configure fetch mock
const fetchMock = createFetchMock(vi);
fetchMock.enableMocks();

// Make vi and fetchMock globally available for compatibility
global.vi = vi;
global.fetchMock = fetchMock;
