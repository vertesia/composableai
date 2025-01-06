import { ContentObjectType, ContentObjectTypeItem, ContentObjectTypeLayout, CreateContentObjectTypePayload, FindPayload, ObjectTypeSearchQuery, ObjectTypeSearchPayload } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";


export class TypesApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/types");
    }

    list(payload: ObjectTypeSearchPayload = {}): Promise<ContentObjectTypeItem[]> {
        const limit = payload.limit || 100;
        const offset = payload.offset || 0;
        const query = payload.query || {} as ObjectTypeSearchQuery;

        return this.get("/", {
            query: {
                limit,
                offset,
                ...query
            }
        });
    }

    find(payload: FindPayload): Promise<ContentObjectType[]> {
        return this.post("/find", {
            payload
        });
    }

    layouts(): Promise<ContentObjectTypeLayout[]> {
        return this.get('/', {
            query: { layout: true }
        });
    }

    retrieve(typeId: string): Promise<ContentObjectType> {
        return this.get(`/${typeId}`);
    }

    getTypeByName(typeName: string): Promise<ContentObjectType> {
        return this.get(`/name/${typeName}`);
    }

    update(typeId: string, payload: Partial<CreateContentObjectTypePayload>): Promise<ContentObjectType> {
        return this.put(`/${typeId}`, {
            payload
        });
    }

    create(payload: CreateContentObjectTypePayload): Promise<ContentObjectType> {
        return this.post(`/`, {
            payload
        });
    }

    delete(id: string) {
        return this.del(`/${id}`);
    }

}