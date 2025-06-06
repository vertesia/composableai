import type { Tool, ToolFunctionParams } from "@vertesia/agent-sdk";
export const WeatherTool = {
    name: "weather",
    description: "Get the current weather for a given location.",
    parameters: {
        type: "object",
        properties: {
            location: {
                type: "string",
                description: "The location to get the weather for, e.g., 'New York, NY'."
            }
        },
        required: ["location"]
    },
    run: async (params: ToolFunctionParams) => {
        const { location } = params;
        // Simulate fetching weather data
        return `The current weather in ${location} is sunny with a temperature of 75°F.`;
    }
} satisfies Tool;