import { defineConfig } from "tsup";

export default defineConfig({
  clean: false,
  entry: [
    "src/index.ts",
    "src/vars.ts",
    "src/activities/index.ts",
    "src/activities/index-dsl.ts",
    "src/workflows.ts",
    "src/dsl.ts",
    "src/errors.ts",
  ],
  format: ["cjs"],
  outDir: "lib/cjs",
  target: "es2024",
});
