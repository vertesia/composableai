
import { log } from "@temporalio/workflow";
import { WorkflowExecutionPayload } from "@vertesia/common";
import * as activities from "../activities/index-dsl.js";
import { dslProxyActivities } from "../dsl/dslProxyActivities.js";
import { NoDocumentFound } from "../errors.js";
import { TextExtractionResult } from "../index.js";

const {
    getObjectFromStore,
    extractDocumentText
} = dslProxyActivities<typeof activities>("generateTextWorkflow", {
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [],
    },
});

const {
    transcribeMedia,
    convertPdfToStructuredText
} = dslProxyActivities<typeof activities>("generateTextWorkflow", {
    startToCloseTimeout: "30 minute",
    retry: {
        initialInterval: '30s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [],
    },
});


export async function generateObjectText(payload: WorkflowExecutionPayload): Promise<TextExtractionResult> {

    const { objectIds } = payload;
    const objectId = objectIds[0];

    const object = await getObjectFromStore(payload, {});

    if (!object.content?.source) {
        throw new NoDocumentFound(`No source or mimetype found for object ${objectId}`, objectIds);
    }
    const mimetype = object.content.type;
    if (!mimetype) {
        throw new NoDocumentFound(`No mimetype found for object ${objectId}`, objectIds);
    }

    const converter = ConverterActivity.find(({ type }) => type.test(mimetype));
    if (!converter) {
        throw new NoDocumentFound(`No converter found for mimetype ${mimetype}`, objectIds);
    }
    log.info(`Converting file type ${mimetype} to text with ${converter.name}`);

    const res = await converter.activity(payload)(payload, converter.params);

    log.info("Generated text for object", { res, objectId });
    return res;

}


const ConverterActivity = [
    {
        type: /application\/pdf/,
        activity: (payload: WorkflowExecutionPayload) => {
            const useTextractForPDF = payload.vars?.useTextractForPdf ?? false;
            return useTextractForPDF ? convertPdfToStructuredText : extractDocumentText;
        },
        name: "ConvertPdfToStructuredText",
        params: {},
    },
    {
        type: /audio\/.+/,
        activity: () => transcribeMedia,
        name: "TranscribeMedia",
        params: {},
    },
    {
        type: /video\/.+/,
        activity: () => transcribeMedia,
        name: "TranscribeMedia",
        params: {},
    },
    {
        type: /.+/,
        activity: () => extractDocumentText,
        name: "extractText",
        params: {},
    }
]
