import { createToolServer } from "@vertesia/tools-sdk";
import { loadInteractions } from "./interactions/index.js";
import { skills } from "./skills/index.js";
import { tools } from "./tools/index.js";

// Load interactions asynchronously
const interactions = await loadInteractions();

// Create server using tools-sdk
const server = createToolServer({
    title: 'Tool Server Template',
    prefix: '/api',
    tools,
    interactions,
    skills,
    // Uncomment and configure MCP providers if needed
    // mcpProviders: []
});

export default server;
