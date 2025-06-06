import { Hono } from 'hono';
import { registry } from "./index.js";

const app = new Hono();

app.post('/', async (c) => {
    const data = await c.req.json();
    const r = await registry.execute(c.req.body())
    return c.json({
        response: r
    })
})

export { app }
