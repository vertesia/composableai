import app from '../src/server';
import { handle } from 'hono/vercel';

export const config = {
    runtime: 'edge', // enables edge function runtime
};

export default handle(app);