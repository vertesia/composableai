import { indexPage, toolCollectionPage, skillCollectionPage, interactionCollectionPage, contentTypeCollectionPage } from '@vertesia/tools-sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ServerConfig } from './config.js';
import { skills } from './skills/index.js';
import { tools } from './tools/index.js';

async function build(outDir) {
    console.log(`Building static site to ${outDir}...`);
    mkdirSync(outDir, { recursive: true });
    const interactions = ServerConfig.interactions;
    const types = ServerConfig.types;
    console.log('Creating index page...');
    let indexHtml = indexPage(ServerConfig);
    writeFile(`${outDir}/index.html`, indexHtml);
    console.log(`Creating ${tools.length} tool collection pages...`);
    for (const coll of tools) {
        const dir = `${outDir}/tools/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(`${dir}/index.html`, toolCollectionPage(coll));
    }
    console.log(`Creating ${skills.length} skill collection pages...`);
    for (const coll of skills) {
        const dir = `${outDir}/skills/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(`${dir}/index.html`, skillCollectionPage(coll));
    }
    console.log(`Creating ${interactions.length} interaction collection pages...`);
    for (const coll of interactions) {
        const dir = `${outDir}/interactions/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(`${dir}/index.html`, interactionCollectionPage(coll));
    }
    console.log(`Creating ${types.length} content type collection pages...`);
    for (const coll of types) {
        const dir = `${outDir}/types/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(`${dir}/index.html`, contentTypeCollectionPage(coll));
    }
    console.log('✓ Static site build complete!');
}
function writeFile(file, content) {
    writeFileSync(file, content.trim() + '\n', "utf8");
}
const outDir = process.argv[2] || './dist';
build(outDir)
    .then(() => {
    process.exit(0);
})
    .catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});
//# sourceMappingURL=build-site.js.map
