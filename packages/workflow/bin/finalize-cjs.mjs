#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cjsDir = new URL("../lib/cjs/", import.meta.url);

fs.writeFileSync(
  new URL("package.json", cjsDir),
  JSON.stringify({ type: "commonjs" }, null, 2),
);

function renameCjsFiles(dirUrl) {
  for (const entry of fs.readdirSync(dirUrl, { withFileTypes: true })) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      renameCjsFiles(entryUrl);
      continue;
    }

    if (!entry.name.endsWith(".cjs")) {
      continue;
    }

    fs.renameSync(
      entryUrl,
      new URL(`${path.basename(entry.name, ".cjs")}.js`, dirUrl),
    );
  }
}

renameCjsFiles(cjsDir);
