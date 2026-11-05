/**
 * The upload of a source to a file, shared by `FilesApi` and `ObjectsApi`. Internal: not exported from the package.
 */
import { RequestError } from '@vertesia/api-fetch-client';
import type { CreateUploadSessionPayload, GetFileUrlResponse } from '@vertesia/common';
import type { StreamSource } from '../StreamSource.js';
import { partsAsUploadBody, planUpload, type UploadPlan, uploadInParts } from './chunked-upload.js';
import type { FilesApi } from './FilesApi.js';
import { fetchSignedUrl } from './signed-url.js';
import { type UploadBody, unquoteEtag, uploadHeaders } from './upload-body.js';
import { UploadSessionUnavailableError } from './upload-runtime.js';
import { resolveUploadMimeType } from './uploadMimeType.js';

/** A location without its query string or fragment, which hold a signed URL's credentials. */
export function fileLocationForError(location: string): string {
    try {
        const url = new URL(location);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return location.split(/[?#]/, 1)[0] || 'unknown file';
    }
}

/** A copy of an error safe to log: every URL in its message is cut to its location. */
export function sanitizedErrorCause(error: unknown): Error | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }
    const message = error.message.replace(/https?:\/\/[^\s)\]}>"']+/g, (url) => fileLocationForError(url));
    const cause = new Error(message);
    cause.name = error.name;
    return cause;
}

/** The stream of a plan, which a failed upload must cancel to release what it holds (a socket, a file). */
function planStream(plan: UploadPlan): ReadableStream | undefined {
    const body = plan.kind === 'parts' ? plan.parts.body : plan.upload.body;
    return body instanceof ReadableStream ? body : undefined;
}

/**
 * Upload a source to the file `request` names: in one signed PUT, or, for a stream source longer than one part in
 * Node.js, in parts through an upload session (see `chunked-upload.ts`). On failure the source's stream is cancelled.
 *
 * @param signUpload the signed PUT URL to use, when the caller already has one or signs it another way
 * @param fallbackMimeType the content type when neither the source nor the server names one
 */
export async function uploadContent(
    files: FilesApi,
    source: StreamSource | File,
    request: CreateUploadSessionPayload,
    signUpload: () => Promise<GetFileUrlResponse> = () => files.getUploadUrl(request),
    fallbackMimeType?: string,
): Promise<{ id: string; path: string; mime_type?: string; etag?: string }> {
    const plan = await planUpload(source);
    try {
        return await sendPlan(files, source, request, plan, signUpload, fallbackMimeType);
    } catch (err: unknown) {
        // A stream already being sent is locked, and its sender cancels it; this one was never read whole.
        await planStream(plan)
            ?.cancel(err)
            .catch(() => undefined);
        throw err;
    }
}

async function sendPlan(
    files: FilesApi,
    source: StreamSource | File,
    request: CreateUploadSessionPayload,
    plan: UploadPlan,
    signUpload: () => Promise<GetFileUrlResponse>,
    fallbackMimeType: string | undefined,
): Promise<{ id: string; path: string; mime_type?: string; etag?: string }> {
    let upload: UploadBody;
    if (plan.kind === 'parts') {
        const session = await files.createUploadSession(request).catch((err: unknown) => {
            // A server without upload sessions, or whose storage has none.
            if (err instanceof RequestError && (err.status === 404 || err.status === 501)) return undefined;
            throw err;
        });
        if (!session) {
            console.warn(`Upload sessions are not available; uploading ${request.name} in a single request`);
            upload = partsAsUploadBody(plan.parts);
        } else {
            try {
                const etag = await uploadInParts(files, session, plan.parts);
                const mime_type = resolveUploadMimeType(source.type, session.mime_type) || fallbackMimeType;
                return { id: session.id, path: session.path, mime_type, etag };
            } catch (err: unknown) {
                if (!(err instanceof UploadSessionUnavailableError)) {
                    console.error('Failed to upload file', { err: sanitizedErrorCause(err), id: session.id });
                    throw err;
                }
                console.warn(`${err.message}; uploading ${session.path} in a single request instead`);
                upload = partsAsUploadBody(plan.parts);
            }
        }
    } else {
        upload = plan.upload;
    }

    const { url, id, path, mime_type } = await signUpload();
    const sourceMimeType = resolveUploadMimeType(source.type, mime_type) || fallbackMimeType;
    const res = await fetchSignedUrl(url, {
        method: 'PUT',
        body: upload.body,
        headers: uploadHeaders(upload, sourceMimeType),
    }).catch((err) => {
        console.error('Failed to upload file', { err, location: fileLocationForError(url), id, path });
        throw err;
    });
    if (!res.ok) {
        console.error('Failed to upload file', {
            status: res.status,
            statusText: res.statusText,
            location: fileLocationForError(url),
            id,
            path,
        });
        throw new Error(`Failed to upload file ${source.name}: ${res.statusText}`);
    }
    return { id, path, mime_type: sourceMimeType, etag: unquoteEtag(res.headers.get('etag') ?? undefined) };
}
