/**
 * Use textract to convert a pdf into a data structure of the following format:
 * <document>
 *  <page number="n">
 *   <text/>
 *   <table/>
 *   <text/>
 *   <figure/>
 *   ...
 *  </page>
 */

import { fromWebToken } from "@aws-sdk/credential-providers";
import { AwsConfiguration, CreateContentObjectPayload, DSLActivityExecutionPayload, DSLActivitySpec, SupportedIntegrations } from "@vertesia/common";
import type { AwsCredentialIdentityProvider } from "@smithy/types";
import { log } from "@temporalio/activity";
import { TextractProcessor } from "../../conversion/TextractProcessor.js";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { NoDocumentFound } from "../../errors.js";
import { TextExtractionResult, TextExtractionStatus } from "../../result-types.js";
import { fetchBlobAsBuffer, md5 } from "../../utils/blobs.js";
import { countTokens } from "../../utils/tokens.js";



export interface ConvertPdfToStructuredTextParams {
    force?: boolean;
}

export interface ConvertPdfToStructuredText extends DSLActivitySpec<ConvertPdfToStructuredTextParams> {
    name: 'ConvertPdfToStructuredText';
}

export interface StructuredTextResult extends TextExtractionResult {
    message?: string;
}



export async function convertPdfToStructuredText(payload: DSLActivityExecutionPayload<ConvertPdfToStructuredTextParams>): Promise<StructuredTextResult> {


    const { params, client, objectId } = await setupActivity<ConvertPdfToStructuredTextParams>(payload);

    const object = await client.objects.retrieve(objectId, "+text");

    if (object.text && !params.force) {
        return { hasText: true, objectId, status: TextExtractionStatus.skipped, message: "text already present and force not enabled" }
    }

    if (!object.content?.source) {
        throw new NoDocumentFound(`No source found for object ${objectId}`);
    }

    const pdfUrl = await client.store.objects.getContentSource(objectId).then(res => res.source);

    if (!pdfUrl) {
        throw new NoDocumentFound(`Error fetching source ${object.content.source}`);
    }

    const project = await client.getProject();
    const awsConfig = (await client.projects.integrations.retrieve(project!.id, SupportedIntegrations.aws)) as AwsConfiguration;
    const credentials = await getS3AWSCredentials(awsConfig, payload.auth_token, project!.id);

    const processor = new TextractProcessor({
        fileKey: objectId,
        region: "us-west-2",
        bucket: "cp-textract-tests",
        credentials,
        log: log,
        detectImages: true,
        includeConfidenceInTables: true,
    });



    try {

        if (!object.content.source.startsWith("s3://")) {
            const buf = await fetchBlobAsBuffer(client, object.content.source);
            await processor.upload(buf);
        }

        const jobId = await processor.startAnalysis(objectId);

        let jobStatus = await processor.checkJobStatus(jobId);
        while (jobStatus === "IN_PROGRESS") {
            await new Promise(resolve => setTimeout(resolve, 5000));
            jobStatus = await processor.checkJobStatus(jobId);
        }

        if (jobStatus === "SUCCEEDED") {
            log.info(`Job ${jobId} succeeded, saving results`, { jobId });
            const fText = await processor.processResults(jobId);
            const tokensData = countTokens(fText);
            const etag = object.content.etag ?? md5(fText);
            const updateData: CreateContentObjectPayload = {
                text: fText,
                text_etag: etag,
                tokens: {
                    ...tokensData,
                    etag: etag,
                }
            }

            await client.objects.update(objectId, updateData);
            console.log("Full text updated");

            return { hasText: true, objectId, status: TextExtractionStatus.success, message: "Text extracted successfully" }

        } else {
            throw new Error(`Job failed with status: ${jobStatus}`);
        }
    } catch (error) {
        console.error("Error processing document:", error);
        throw error;
    }


}

export async function getS3AWSCredentials(awsConfig: AwsConfiguration, composableAuthToken: string, projectId: string): Promise<AwsCredentialIdentityProvider> {

    // fetch s3 role ARN
    if (!awsConfig || !awsConfig.enabled) {
        throw new NoDocumentFound("AWS integration is not enabled for this project");
    }
    if (!awsConfig.s3_role_arn) {
        throw new NoDocumentFound("S3 Role ARN is not defined in AWS project integration");
    }

    log.info("Getting AWS credentials for Textract", { projectId, composableAuthToken, roleArn: awsConfig.s3_role_arn });

    const credentials = fromWebToken({
        webIdentityToken: composableAuthToken,
        roleArn: awsConfig.s3_role_arn,
        roleSessionName: `cp-project-textract-${projectId}`,
    });

    return credentials;
}
