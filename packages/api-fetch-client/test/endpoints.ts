
import { Resource, get } from "@koa-stack/router";
import { Context } from "koa";

export default class Endpoints extends Resource {

    @get("/")
    async getRoot(ctx: Context) {
        return { message: "Hello World!" };
    }

    @get("/token")
    async getAuthToken(ctx: Context) {
        const token = (ctx.headers.authorization as string).split(" ")[1];
        return { token };
    }

    @get("/html")
    async getHTML(ctx: Context) {
        ctx.response.type = "html";
        return "<html><body>Hello!</body></html>";
    }

    @get("/html-error")
    async getHTMLError(ctx: Context) {
        ctx.response.type = "html";
        ctx.status = 401;
        return "<html><body>Error!</body></html>";
    }

    @get("/no-content")
    async getNoContent(ctx: Context) {
        ctx.response.type = "html";
        ctx.status = 204;
    }

    @get("/xml")
    async getXML(ctx: Context) {
        ctx.response.type = "application/xml";
        return '<document></document>'
    }

}

