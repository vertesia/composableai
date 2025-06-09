import type { Tool, ToolFunctionParams } from "@vertesia/agent-sdk";

interface WeatherToolParams {
    location: string;
}

export const WeatherTool = {
    name: "weather",
    description: "Get the current weather for a given location.",
    input_schema: {
        type: "object",
        properties: {
            location: {
                type: "string",
                description: "The location to get the weather for, e.g., 'New York, NY'."
            }
        },
        required: ["location"]
    },
    run: async (params: ToolFunctionParams<WeatherToolParams>) => {
        const { location } = params.input;
        // Simulate fetching weather data
        return `The current weather in ${location} is sunny with a temperature of 75°F.`;
    }
} satisfies Tool<WeatherToolParams>;
