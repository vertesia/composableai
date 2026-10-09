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
    label: string;
    /** Attachments not yet ready. Finished ones are counted in the label, not listed. */
    outstanding: AttachmentPreparationFile[];
}

/**
 * Progress of the attachments the first turn is waiting on, read from the run's file states.
 * Undefined when nothing is outstanding; polling stops once the run has settled.
 */
export function useAttachmentPreparation(
    client: VertesiaClient,
    agentRunId: string | undefined,
    active: boolean,
): AttachmentPreparation | undefined {
    // Translated at render time: getFixedT returns a new function per render, and as an effect
    // dependency it would cancel the poll in flight on every render.
    const [files, setFiles] = useState<AgentRunFile[] | undefined>(undefined);
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
                // A failed poll keeps the current label.
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
