import {
    contentTypeCollectionPage,
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    templateCollectionPage,
    toolCollectionPage
} from "@vertesia/tools-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { ServerConfig } from "./config.js";
import { skills } from "./skills/index.js";
import { tools } from "./tools/index.js";
/**
 * Generates static HTML pages for all tool collections, skills, and interactions
 * This runs during the build process to create browsable documentation
 */
async function build(outDir: string) {
    console.log(`Building static site to ${outDir}...`);

    // Ensure output directory exists
    mkdirSync(outDir, { recursive: true });

    // Load interactions
    const interactions = ServerConfig.interactions;
    const types = ServerConfig.types;

    // Create main index page
    console.log('Creating index page...');
    const indexHtml = indexPage(ServerConfig);

    writeFile(
        `${outDir}/index.html`,
        indexHtml
    );

    // Create pages for each tool collection
    console.log(`Creating ${tools.length} tool collection pages...`);
    for (const coll of tools) {
        const dir = `${outDir}/tools/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            toolCollectionPage(coll)
        );
    }

    // Create pages for each skill collection
    console.log(`Creating ${skills.length} skill collection pages...`);
    for (const coll of skills) {
        const dir = `${outDir}/skills/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            skillCollectionPage(coll)
        );
    }

    // Create pages for each interaction collection
    console.log(`Creating ${interactions.length} interaction collection pages...`);
    for (const coll of interactions) {
        const dir = `${outDir}/interactions/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            interactionCollectionPage(coll)
        );
    }

    // Create pages for each template collection
    const templates = ServerConfig.templates;
    console.log(`Creating ${templates.length} template collection pages...`);
    for (const coll of templates) {
        const dir = `${outDir}/templates/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            templateCollectionPage(coll)
        );
    }

    // Content type collection pages
    console.log(`Creating ${types.length} content type collection pages...`);
    for (const coll of types) {
        const dir = `${outDir}/types/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            contentTypeCollectionPage(coll)
        );
    }

    console.log('✓ Static site build complete!');
}

function writeFile(file: string, content: string) {
    writeFileSync(file, content.trim() + '\n', "utf8");
}

// Run the build
const outDir = process.argv[2] || './dist';
build(outDir)
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Build failed:', error);
        process.exit(1);
    });
