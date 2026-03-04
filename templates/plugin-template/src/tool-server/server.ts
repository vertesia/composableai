import { createToolServer } from "@vertesia/tools-sdk";
import { ServerConfig } from "./config.js";

// Create server using tools-sdk
const server = createToolServer(ServerConfig);

export default server;
