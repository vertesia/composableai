import type { FindPayload } from "@vertesia/common";
import type { VertesiaClient } from "@vertesia/client";
import { DataProvider } from "./DataProvider.js";

function useMongoId(query: Record<string, unknown>) {
    if (query.id) {
        const { id, ...rest } = query;
        return { ...rest, _id: id };
    }
    return query;
}

function asRecords<T extends object>(items: T[]): Record<string, unknown>[] {
    return items as unknown as Record<string, unknown>[];
}

export class DocumentProvider extends DataProvider {
    static ID = "document";
    constructor(public client: VertesiaClient) {
        super(DocumentProvider.ID, true);
    }

    doFetch(payload: FindPayload): Promise<Record<string, unknown>[]> {
        const query = useMongoId(payload.query);
        return this.client.objects.find({
            query, select: payload.select, limit: payload.limit
        }).then(asRecords);
    }

    static factory(client: VertesiaClient) {
        return new DocumentProvider(client);
    }
}

export class DocumentTypeProvider extends DataProvider {
    static ID = "document_type";
    constructor(public client: VertesiaClient) {
        super(DocumentTypeProvider.ID, true);
    }

    doFetch(payload: FindPayload): Promise<Record<string, unknown>[]> {
        const query = useMongoId(payload.query);
        return this.client.types.find({
            query, select: payload.select, limit: payload.limit
        }).then(asRecords);
    }

    static factory(client: VertesiaClient) {
        return new DocumentTypeProvider(client);
    }
}

export class InteractionRunProvider extends DataProvider {
    static ID = "interaction_run";
    constructor(public client: VertesiaClient) {
        super(DocumentProvider.ID, true);
    }

    doFetch(payload: FindPayload): Promise<Record<string, unknown>[]> {
        const query = useMongoId(payload.query);
        return this.client.runs.find({
            query, select: payload.select, limit: payload.limit
        }).then(asRecords);
    }

    static factory(client: VertesiaClient) {
        return new InteractionRunProvider(client);
    }

}
