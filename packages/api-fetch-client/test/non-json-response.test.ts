import assert from "assert";
import { FetchClient } from "../src/index.js";

describe("Non-JSON response handling", () => {
    it("surfaces non-JSON error responses without replacing them with a JSON parse error", async () => {
        const client = new FetchClient(
            "https://example.test/api/v1",
            async () =>
                new Response("<html><body>Error!</body></html>", {
                    status: 500,
                    headers: {
                        "content-type": "text/html; charset=utf-8",
                    },
                }),
        );

        await assert.rejects(
            () => client.get("/objects/search"),
            (error: any) => {
                assert.equal(error.status, 500);
                assert.equal(
                    error.original_message,
                    "Expected JSON response but received text/html; charset=utf-8",
                );
                assert.equal(error.payload.content_type, "text/html; charset=utf-8");
                assert.match(error.payload.parse_error, /Unexpected token/);
                assert.equal(error.payload.text, "<html><body>Error!</body></html>");
                return true;
            },
        );
    });
});
