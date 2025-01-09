import { ActivityFetchSpec } from "@vertesia/common";
import { VertesiaClient } from "@vertesia/client";
import { DataProvider } from "./DataProvider.js";


const factories: Record<string, ((client: VertesiaClient, source?: string) => DataProvider)> = {};


export function registerFetchProviderFactory(name: string, factory: ((client: VertesiaClient) => DataProvider)) {
    factories[name] = factory;
}

export function getFetchProvider(client: VertesiaClient, fetchSpec: ActivityFetchSpec) {
    const factory = factories[fetchSpec.type];
    if (!factory) {
        throw new Error("Unknown data provider: " + fetchSpec.source);
    }
    return factory(client, fetchSpec.source);
}
