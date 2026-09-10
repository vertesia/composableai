import type { VertesiaClient } from '@vertesia/client';
import { type AgentRunFile, FileProcessingStatus } from '@vertesia/common';
import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 1_500;

export interface AttachmentPreparationFile {
    id: string;
    name: string;
    status: FileProcessingStatus;
}

export interface AttachmentPreparation {
    /** The heading: how far along the set is. */
    label: string;
    /**
     * Only the attachments still outstanding. A file that is done needs no row — the heading's
     * count already says how many got there, and listing them pushes the ones being waited on
     * down the list.
     */
    outstanding: AttachmentPreparationFile[];
}

/**
 * Why the first turn has not started yet.
 *
 * A run created from staged files holds its first turn until their text has been extracted, which
 * can take a minute for a large PDF. The workflow does announce this, but only into the activity
 * stream, which the summary view — the default, and the one most people see — buckets away. So the
 * view asks the run directly rather than waiting to be told, reading the same file states the
 * workflow gates on.
 *
 * Returns undefined when there is nothing to explain: no attachments, or all of them settled.
 */
export function useAttachmentPreparation(
    client: VertesiaClient,
    agentRunId: string | undefined,
    active: boolean,
): AttachmentPreparation | undefined {
    // State holds the files, never the sentence. i18nInstance.getFixedT returns a new function on
    // every render, so translating inside the effect would put an unstable value in its deps — the
    // effect would re-run each render and its cleanup would cancel the poll still in flight.
    const [files, setFiles] = useState<AgentRunFile[] | undefined>(undefined);
    // Set once this run has nothing left to report, so a settled run stops polling for good
    // instead of asking again every interval for as long as the agent works.
    const settledRunRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!agentRunId) return;
        if (settledRunRef.current !== agentRunId) {
            settledRunRef.current = undefined;
            setFiles(undefined);
        }
        if (!active || settledRunRef.current === agentRunId) return;

        let cancelled = false;
        let timer: ReturnType<typeof setInterval> | undefined;
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = undefined;
        };

        const poll = async () => {
            let response: Awaited<ReturnType<typeof client.agents.getFiles>>;
            try {
                response = await client.agents.getFiles(agentRunId);
            } catch {
                // The indicator keeps its generic label; a failed poll is not worth surfacing.
                return;
            }
            if (cancelled) return;
            const unsettled = response.files.filter(
                (file) =>
                    file.status === FileProcessingStatus.UPLOADING || file.status === FileProcessingStatus.PROCESSING,
            );
            if (unsettled.length === 0) {
                settledRunRef.current = agentRunId;
                setFiles(undefined);
                stop();
                return;
            }
            setFiles(response.files);
        };

        void poll();
        timer = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            stop();
        };
    }, [active, agentRunId, client]);

    if (!files) return undefined;
    const t = i18nInstance.getFixedT(null, NAMESPACE);
    const ready = files.filter((file) => file.status === FileProcessingStatus.READY).length;
    return {
        label: t('agent.attachmentsPreparing', { ready, total: files.length }),
        outstanding: files
            .filter((file) => file.status !== FileProcessingStatus.READY)
            .map((file) => ({ id: file.id, name: file.name, status: file.status })),
    };
}
