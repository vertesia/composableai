import { ToolRegistry } from '@vertesia/agent-sdk';
import { WeatherTool } from "./tools/WeatherTool.js";

export const registry = new ToolRegistry([
    WeatherTool
]);
