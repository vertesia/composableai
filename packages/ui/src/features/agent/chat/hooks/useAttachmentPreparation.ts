import type { VertesiaClient } from '@vertesia/client';
import { FileProcessingStatus } from '@vertesia/common';
import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 1_500;

interface PendingAttachments {
    ready: number;
    total: number;
    names: string;
}

/**
 * Why the first turn has not started yet, as a line the waiting indicator can show.
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
): string | undefined {
    // State holds the counts, never the sentence. i18nInstance.getFixedT returns a new function
    // on every render, so translating inside the effect would put an unstable value in its deps —
    // the effect would re-run each render and its cleanup would cancel the poll still in flight.
    const [pending, setPending] = useState<PendingAttachments | undefined>(undefined);
    // Set once this run has nothing left to report, so a settled run stops polling for good
    // instead of asking again every interval for as long as the agent works.
    const settledRunRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!agentRunId) return;
        if (settledRunRef.current !== agentRunId) {
            settledRunRef.current = undefined;
            setPending(undefined);
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
                setPending(undefined);
                stop();
                return;
            }
            setPending({
                ready: response.files.length - unsettled.length,
                total: response.files.length,
                names: unsettled.map((file) => file.name).join(', '),
            });
        };

        void poll();
        timer = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            stop();
        };
    }, [active, agentRunId, client]);

    if (!pending) return undefined;
    return i18nInstance.getFixedT(null, NAMESPACE)('agent.attachmentsPreparing', {
        ready: pending.ready,
        total: pending.total,
        names: pending.names,
    });
}
