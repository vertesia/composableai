import { ToolCollection } from "@vertesia/tools-sdk";
import { CalculatorTool } from "./calculator.js";
import icon from "./icon.svg.js";

export const CalculatorTools = new ToolCollection({
    name: "calculator",
    title: "Calculator Tools",
    description: "A collection of tools for performing mathematical calculations",
    icon,
    tools: [CalculatorTool]
});
