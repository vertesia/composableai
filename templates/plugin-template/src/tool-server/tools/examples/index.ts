import { ToolCollection } from "@vertesia/tools-sdk";
import { CalculatorTool } from "./calculator/index.js";
import icon from "./icon.svg.js";

export const ExampleTools = new ToolCollection({
    name: "examples",
    title: "Example Tools",
    description: "A collection of example tools",
    icon,
    tools: [CalculatorTool]
});
