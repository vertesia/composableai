import { ContentObjectType, ContentObjectTypeItem, CreateContentObjectTypePayload, FindPayload, ObjectTypeSearchQuery, ObjectTypeSearchPayload } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { TypeCatalogApi } from "./TypeCatalogApi.js";


export class TypesApi extends ApiTopic {
    catalog: TypeCatalogApi;

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/types");
        this.catalog = new TypeCatalogApi(parent);
    }

    /**
     * The options can be used to include more information in the return objects.
     * You can specify to also include layout information using `layout: true`.
     * By default the layout information is not included.
     * @param payload
     * @param options
     * @returns
     */
    list(payload: ObjectTypeSearchPayload = {}, options?: { layout?: boolean, schema?: boolean }): Promise<ContentObjectTypeItem[]> {
        const limit = payload.limit || 2000;
        const offset = payload.offset || 0;
        const query = payload.query || {} as ObjectTypeSearchQuery;

        return this.get("/", {
            query: {
                limit,
                offset,
                layout: options?.layout ? true : false,
                schema: options?.schema ? true : false,
                ...query
            }
        });
    }

    find(payload: FindPayload): Promise<ContentObjectType[]> {
        return this.post("/find", {
            payload
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