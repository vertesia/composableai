import { FindPayload } from "@vertesia/common";
import { VertesiaClient } from "@vertesia/client";
import { DataProvider } from "./DataProvider.js";

function useMongoId(query: Record<string, any>) {
    if (query.id) {
        const result = { ...query, _id: query.id }
        delete (result as any).id;
        return result;
    }
    return query;
}

export class DocumentProvider extends DataProvider {
    static ID = "document";
    constructor(public client: VertesiaClient) {
        super(DocumentProvider.ID, true);
    }

    doFetch(payload: FindPayload): Promise<Record<string, any>[]> {
        const query = useMongoId(payload.query);
        return this.client.objects.find({
            query, select: payload.select, limit: payload.limit
        });
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

    doFetch(payload: FindPayload): Promise<Record<string, any>[]> {
        const query = useMongoId(payload.query);
        return this.client.types.find({
            query, select: payload.select, limit: payload.limit
        });
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

    doFetch(payload: FindPayload): Promise<Record<string, any>[]> {
        const query = useMongoId(payload.query);
        return this.client.runs.find({
            query, select: payload.select, limit: payload.limit
        });
    }

    static factory(client: VertesiaClient) {
        return new InteractionRunProvider(client);
    }

}