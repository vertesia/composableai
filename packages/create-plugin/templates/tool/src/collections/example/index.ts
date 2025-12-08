import { ToolCollection } from "@vertesia/tools-sdk";
import { icon } from "./icon.svg.js";
import { WeatherTool } from "./weather/WeatherTool.js";

export const ExampleCollection = new ToolCollection({
    name: "example",
    title: "Example Tools",
    description: "A collection of example tools to get you started",
    icon,
    tools: [
        WeatherTool
        // Add more tools here
    ]
});
