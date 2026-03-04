import { ServerResponse, IncomingMessage } from 'http';

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true', // Required for Chrome Private Network Access
    'Access-Control-Max-Age': '86400' // 1 day
};

export function handleCors(req: IncomingMessage, res: ServerResponse) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return true;
    } else {
        // Set CORS headers for non-OPTIONS requests without changing status code
        for (const [key, value] of Object.entries(corsHeaders)) {
            res.setHeader(key, value);
        }
    }
    return false;
}