import { WorkflowExecutionPayload } from "@vertesia/common";

import { log, proxyActivities } from "@temporalio/workflow";
import * as activities from "./activities/index.js";
import { IterativeGenerationPayload, PartIndex, SECTION_ID_PLACEHOLDER } from "./types.js";

const {
    it_gen_extractToc,
    it_gen_generateToc,
    it_gen_generatePart,
    it_gen_finalizeOutput
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "15 minute",
    retry: {
        initialInterval: '30s',
        backoffCoefficient: 2,
        maximumAttempts: 20,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [],
    },
});

export async function iterativeGenerationWorkflow(payload: WorkflowExecutionPayload) {
    log.info(`Executing Iterative generation workflow.`);

    const vars = payload.vars as IterativeGenerationPayload;
    if (vars.section_file_pattern && !vars.section_file_pattern.includes(SECTION_ID_PLACEHOLDER)) {
        throw new Error(`Invalid section_file_pattern: ${vars.section_file_pattern}. It must include the ${SECTION_ID_PLACEHOLDER} placeholder.`);
    }

    // extractToc tries to extract the toc from the input memory pack (toc.json or toc.yaml)
    // the generateToc activity is retiurning the toc hierarchy.
    // It doesn't include extra TOC details like description etc.
    // To minimize the payload size only the hierarchy and the section/part names are returned
    let toc = await it_gen_extractToc(payload);
    if (!toc) {
        log.info(`No TOC was specified in the input memory pack. Generating one.`);
        toc = await it_gen_generateToc(payload);
    } else {
        log.info(`Using the TOC specified in the input memory pack.`);
    }

    if (toc.sections.length === 0) {
        //TODO how to handle this case?
        throw new Error("Nothing to generate: TOC is empty");
    }

    for (const section of toc.sections) {
        log.info(`Generating section: ${formatPath(section)}`);
        await it_gen_generatePart(payload, section.path);

        if (section.parts) {
            for (const part of section.parts) {
                log.info(`Generating part: ${formatPath(part)}`);
                await it_gen_generatePart(payload, part.path);
            }
        }
    }

    log.info(`Post-processing output memory pack`);
    await it_gen_finalizeOutput(payload);
}

function formatPath(node: PartIndex) {
    // we print 1 based indexes
    return node.path.map(i => i + 1).join('.') + ' ' + node.name;
}