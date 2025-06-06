import { Hono } from 'hono';
import { registry } from "./index.js";

const app = new Hono();

app.post('/', async (c) => {
    const data = await c.req.json();
    const r = await registry.execute(data)
    return c.json({
        response: r
    })
})

app.get('/', (c) => {
    return c.json(registry.getDefinitions())
});

export default app;
