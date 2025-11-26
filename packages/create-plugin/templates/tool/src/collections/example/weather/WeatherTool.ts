import type { Tool, ToolExecutionPayload, ToolExecutionContext } from "@vertesia/tools-sdk";
import manifest from "./manifest.js";
import { ToolResultContent } from "@vertesia/common";

interface WeatherToolParams {
    location: string;
}

// Tool implementation function
export async function weather(
    payload: ToolExecutionPayload<WeatherToolParams>,
    context: ToolExecutionContext
) {
    const { location } = payload.tool_use.tool_input!;

    console.log(`Caller: ${context.payload.user_id}`);
    
    // Simulate fetching weather data
    // In a real implementation, you would call a weather API here
    // You can use context.getClient() to access Vertesia services if needed
    
    return {
        is_error: false,
        content: `The current weather in ${location} is sunny with a temperature of 75°F.`
    } satisfies ToolResultContent;
}

// Export the complete tool with manifest and implementation
export const WeatherTool = {
    ...manifest,
    run: weather
} satisfies Tool<WeatherToolParams>;
