import { ContentEventName, DSLActivityExecutionPayload } from "@vertesia/common";
import { describe, expect, it } from "vitest";
import { setupActivity } from "./ActivityContext.js";

const MOCK_AUTH_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature";

function basePayload<T extends Record<string, any>>(
    activity: DSLActivityExecutionPayload<T>["activity"],
    params: T,
): DSLActivityExecutionPayload<T> {
    return {
        event: ContentEventName.create,
        vars: {},
        account_id: "acc",
        project_id: "prj",
        auth_token: MOCK_AUTH_TOKEN,
        config: { studio_url: "http://localhost", store_url: "http://localhost" },
        activity,
        params,
        workflow_name: "test",
    };
}

describe("setupActivity", () => {
    // Regression guard: user-supplied strings containing "${...}" must be preserved
    // verbatim when the activity is dispatched from TypeScript code (no activity.params,
    // no activity.fetch). Previously Vars.parse/resolve would treat any "${...}" as a
    // template ref and silently drop the key when it failed to resolve.
    it("preserves user data containing literal ${} in code-dispatched activities", async () => {
        const data = {
            task: 'preserve "${}" literal',
            other: "also has ${undefined_ref}",
        };
        const payload = basePayload({ name: "testActivity" }, { data });
        const ctx = await setupActivity(payload);
        expect(ctx.params.data.task).toBe('preserve "${}" literal');
        expect(ctx.params.data.other).toBe("also has ${undefined_ref}");
    });

    it("returns empty params when code-dispatched activity has no params", async () => {
        const payload = basePayload({ name: "testActivity" }, undefined as any);
        const ctx = await setupActivity(payload);
        expect(ctx.params).toEqual({});
    });

    // Counter-test: DSL-defined activities (those carrying activity.params) must
    // still have their ${refs} resolved against payload.params (imported vars).
    it("still resolves ${refs} in activity.params for DSL-dispatched activities", async () => {
        const payload = basePayload(
            { name: "dslActivity", params: { message: "Hello ${name}" } },
            { name: "World" } as any,
        );
        const ctx = await setupActivity(payload);
        expect((ctx.params as any).message).toBe("Hello World");
    });
});
