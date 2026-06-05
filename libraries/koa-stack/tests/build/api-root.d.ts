import { Resource, type Router } from '@koa-stack/router';
import type { Context } from 'koa';
export declare class ApiIntercept extends Resource {
    getIntercepted(_ctx: Context): "bug: not an instance of ApiIntercept" | "hello";
}
export declare class BaseResource extends Resource {
    onAccess(ctx: Context): boolean;
    getHelloFromBase(ctx: Context): void;
    getOverwriteBase(ctx: Context): void;
    getTextIndex(): string;
    getTextIndex2(): string;
    setup(router: Router): void;
}
export declare class VersionedApi extends Resource {
    unversioned(_ctx: Context): Promise<string>;
    getHello(_ctx: Context): Promise<string>;
    getV1Hello(_ctx: Context): Promise<string>;
    getV2Hello(_ctx: Context): Promise<string>;
    getV3Hello(_ctx: Context): Promise<string>;
}
export declare class ApiRoot extends BaseResource {
    onAccess(ctx: Context): boolean;
    getHelloEndpoint(ctx: Context): void;
    getPayloadWithReturn(_ctx: Context): string;
    getOverwriteBase(ctx: Context): void;
    postBody(ctx: Context): void;
    parseNullBody(ctx: Context): Promise<void>;
    filters(ctx: Context): Promise<any>;
    protectedEndpoint(): string;
}
export declare class ApiRootBad extends BaseResource {
    getRootEndpoint(ctx: Context): void;
    /**
     * bad way to overwrite the guard.
     * It works but you don't need to define a new guard.
     * You should simply overwrite the method
     */
    onAccess2(ctx: Context): boolean;
    /**
     * Bas way to overwrite a base endpoint.
     * Even if it works, you should overwrite the method and not redefine the route
     * @param ctx
     */
    getOwnOverwriteBase(ctx: Context): void;
}
export declare class ChildApi extends BaseResource {
    getIndex(ctx: Context): void;
}
export declare class OtherApi extends BaseResource {
    getIndex(ctx: Context): void;
}
//# sourceMappingURL=api-root.d.ts.map