
import { Resource, Router } from "@koa-stack/router";
import { Context } from "koa";

export default class Endpoints extends Resource {

    setup(router: Router) {
        router.get("/", this.getRoot, this);
        router.get("/token", this.getAuthToken, this);
        router.get("/html", this.getHTML, this);
        router.get("/html-error", this.getHTMLError, this);
        router.get("/no-content", this.getNoContent, this);
    }

    async getRoot(ctx: Context) {
        return { message: "Hello World!" };
    }

    async getAuthToken(ctx: Context) {
        const token = (ctx.headers.authorization as string).split(" ")[1];
        return { token };
    }

    async getHTML(ctx: Context) {
        ctx.response.type = "html";
        return "<html><body>Hello!</body></html>";
    }

    async getHTMLError(ctx: Context) {
        ctx.response.type = "html";
        ctx.status = 401;
        return "<html><body>Error!</body></html>";
    }

    async getNoContent(ctx: Context) {
        ctx.response.type = "html";
        ctx.status = 204;
    }

}
