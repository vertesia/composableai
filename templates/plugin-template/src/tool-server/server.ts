import { createToolServer } from '@vertesia/tools-sdk';
import type { Hono } from 'hono';
import { ServerConfig } from './config.js';

// Create server using tools-sdk
const server: Hono = createToolServer(ServerConfig);

export default server;
