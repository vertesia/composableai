import { type DocAnalyzerProgress, MarkdownRenditionFormat, WorkflowExecutionStatus } from '@vertesia/common';
import { usePolling } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { isEqual } from 'lodash-es';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Maximum text size before cropping (128K characters)
const MAX_TEXT_DISPLAY_SIZE = 128 * 1024;

/**
 * Hook for managing object text loading and cropping.
 */
export function useObjectText(objectId: string, initialText?: string, loadOnMount = false, changeGroupId = objectId) {
    const { store } = useUserSession();

    const [fullText, setFullText] = useState<string | undefined>(initialText);
    const [displayText, setDisplayText] = useState<string | undefined>(() => {
        if (initialText && initialText.length > MAX_TEXT_DISPLAY_SIZE) {
            return initialText.substring(0, MAX_TEXT_DISPLAY_SIZE);
        }
        return initialText;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isCropped, setIsCropped] = useState(() => !!initialText && initialText.length > MAX_TEXT_DISPLAY_SIZE);
    const [changeHighlight, setChangeHighlight] = useState<{ previousText: string; version: number }>();
    const fullTextRef = useRef(initialText);
    const objectIdRef = useRef(objectId);
    const changeGroupIdRef = useRef(changeGroupId);
    const suppressNextHighlightRef = useRef(false);

    const applyText = useCallback((nextText: string | undefined, shouldHighlight = true) => {
        const previousText = fullTextRef.current;
        if (shouldHighlight && previousText && nextText && previousText !== nextText) {
            setChangeHighlight((current) => ({
                previousText,
                version: (current?.version ?? 0) + 1,
            }));
        } else if (!shouldHighlight) {
            setChangeHighlight(undefined);
        }

        fullTextRef.current = nextText;
        setFullText(nextText);
        if (nextText && nextText.length > MAX_TEXT_DISPLAY_SIZE) {
            setDisplayText(nextText.substring(0, MAX_TEXT_DISPLAY_SIZE));
            setIsCropped(true);
        } else {
            setDisplayText(nextText);
            setIsCropped(false);
        }
    }, []);

    const loadText = useCallback(() => {
        const requestedObjectId = objectId;
        const requestedChangeGroupId = changeGroupId;
        setIsLoading(true);
        store.objects
            .getObjectText(objectId)
            .then((res) => {
                if (objectIdRef.current !== requestedObjectId) return;
                const shouldHighlight =
                    changeGroupIdRef.current === requestedChangeGroupId && !suppressNextHighlightRef.current;
                applyText(res.text, shouldHighlight);
                suppressNextHighlightRef.current = false;
            })
            .catch((err) => {
                console.error('Failed to load text', err);
            })
            .finally(() => {
                if (objectIdRef.current === requestedObjectId) setIsLoading(false);
            });
    }, [applyText, changeGroupId, objectId, store]);

    // Reset state when objectId changes
    useLayoutEffect(() => {
        const objectChanged = objectIdRef.current !== objectId;
        const changeGroupChanged = changeGroupIdRef.current !== changeGroupId;
        objectIdRef.current = objectId;
        changeGroupIdRef.current = changeGroupId;
        if (changeGroupChanged) suppressNextHighlightRef.current = true;

        // Keep the previous revision mounted until the next revision's text is ready.
        if (initialText !== undefined) {
            applyText(initialText, !changeGroupChanged);
            suppressNextHighlightRef.current = false;
        }

        // Load text if requested
        if (loadOnMount && initialText === undefined && (objectChanged || fullTextRef.current === undefined)) {
            loadText();
        }
    }, [applyText, changeGroupId, initialText, loadOnMount, loadText, objectId]);

    return {
        fullText,
        displayText,
        isLoading,
        isCropped,
        changeHighlight,
        loadText,
    };
}

/**
 * Hook for polling PDF/document processing status.
 */
export function usePdfProcessingStatus(objectId: string, shouldPoll: boolean) {
    const { client } = useUserSession();

    const [state, setState] = useState<{
        progress?: DocAnalyzerProgress;
        status?: WorkflowExecutionStatus;
        isComplete: boolean;
    }>({ isComplete: false });

    // Progress is read every 2 seconds while the workflow runs. Before it exists, the request fails with 404,
    // which is expected, so that is checked every 10 seconds. Other failures are retried at the same cadence,
    // and a permanent one stops the poll. A completed or failed workflow ends it.
    const runningRef = useRef(false);
    usePolling(
        async (signal) => {
            const r = await client.objects.analyze(objectId).getStatus();
            if (signal.aborted) return false;
            const running = r.status === WorkflowExecutionStatus.RUNNING;
            runningRef.current = running;
            setState((prev) => {
                if (prev.status === r.status && prev.isComplete === !running && isEqual(prev.progress, r.progress)) {
                    return prev;
                }
                return { progress: r.progress, status: r.status, isComplete: !running };
            });
            return !running;
        },
        {
            enabled: shouldPoll,
            intervalMs: () => (runningRef.current ? 2_000 : 10_000),
            // 404 is expected until the workflow exists, so it is retried; other 4xx still end the poll.
            retryStatuses: [404],
            onError: () => {
                runningRef.current = false;
            },
        },
        [objectId, client],
    );

    return {
        progress: state.progress,
        status: state.status,
        isComplete: state.isComplete,
    };
}

/**
 * Hook for managing Office document to PDF conversion.
 */
export function useOfficePdfConversion(objectId: string, enabled: boolean) {
    const { client } = useUserSession();
    // `getFixedT` returns a new function on every call; memoised so the poll below is not restarted each render.
    const t = useMemo(() => i18nInstance.getFixedT(null, NAMESPACE), []);

    const [pdfUrl, setPdfUrl] = useState<string | undefined>();
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    // Only the first request asks the server to generate the PDF. It stays set until a request gets an answer,
    // so a failed first request does not lose the conversion.
    const generateRef = useRef(false);

    // Checks every 5 seconds while the PDF is generating. A permanent error ends the conversion with a message;
    // a transient one is retried.
    usePolling(
        async (signal) => {
            const response = await client.objects.getRendition(objectId, {
                format: MarkdownRenditionFormat.pdf,
                generate_if_missing: generateRef.current,
                sign_url: true,
                block_on_generation: false,
            });
            if (signal.aborted) return false;
            generateRef.current = false;
            if (response.status === 'generating') {
                setError(undefined);
                return false;
            }
            if (response.status === 'found' && response.renditions?.length) {
                setPdfUrl(response.renditions[0]);
                setError(undefined);
            } else {
                setError(t('store.pdfConversionFailed'));
            }
            setIsConverting(false);
            return true;
        },
        {
            enabled: isConverting,
            intervalMs: 5_000,
            onError: (err, permanent) => {
                // A transient failure keeps the conversion going, but the user is told it is failing.
                setError(t('store.failedToConvertToPdf'));
                if (!permanent) return;
                console.error('Failed to convert Office document to PDF:', err);
                setIsConverting(false);
            },
        },
        [objectId, client, t],
    );

    const triggerConversion = useCallback(() => {
        if (!enabled || isConverting) return;
        generateRef.current = true;
        setIsConverting(true);
        setError(undefined);
    }, [enabled, isConverting]);

    return {
        pdfUrl,
        isConverting,
        error,
        triggerConversion,
    };
}
