import { type DocAnalyzerProgress, MarkdownRenditionFormat, WorkflowExecutionStatus } from '@vertesia/common';
import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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

    useEffect(() => {
        if (!shouldPoll) return;

        let interrupted = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const updateStateIfChanged = (
            nextProgress: DocAnalyzerProgress | undefined,
            nextStatus: WorkflowExecutionStatus | undefined,
            nextIsComplete: boolean,
        ) => {
            setState((prev) => {
                const prevProgress = JSON.stringify(prev.progress ?? null);
                const nextProgressSignature = JSON.stringify(nextProgress ?? null);

                if (
                    prev.status === nextStatus &&
                    prev.isComplete === nextIsComplete &&
                    prevProgress === nextProgressSignature
                ) {
                    return prev;
                }

                return {
                    progress: nextProgress,
                    status: nextStatus,
                    isComplete: nextIsComplete,
                };
            });
        };

        function poll() {
            if (interrupted) return;

            client.objects
                .analyze(objectId)
                .getStatus()
                .then((r) => {
                    if (r.status === WorkflowExecutionStatus.RUNNING) {
                        updateStateIfChanged(r.progress, r.status, false);
                        // Workflow is running, poll every 2 seconds for progress
                        if (!interrupted) {
                            timeoutId = setTimeout(poll, 2000);
                        }
                    } else {
                        // Workflow completed or terminal state
                        updateStateIfChanged(r.progress, r.status, true);
                    }
                })
                .catch(() => {
                    // No workflow found yet, poll every 10 seconds to check if one starts
                    if (!interrupted) {
                        timeoutId = setTimeout(poll, 10000);
                    }
                });
        }

        poll();
        return () => {
            interrupted = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [shouldPoll, objectId, client]);

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
    const t = i18nInstance.getFixedT(null, NAMESPACE);

    const [pdfUrl, setPdfUrl] = useState<string | undefined>();
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const triggerConversion = useCallback(async () => {
        if (!enabled || isConverting) return;

        setIsConverting(true);
        setError(undefined);

        const pollForPdf = async (isFirstCall: boolean) => {
            try {
                const response = await client.objects.getRendition(objectId, {
                    format: MarkdownRenditionFormat.pdf,
                    generate_if_missing: isFirstCall,
                    sign_url: true,
                    block_on_generation: false,
                });

                if (response.status === 'generating') {
                    // Poll every 5 seconds
                    setTimeout(() => pollForPdf(false), 5000);
                } else if (response.status === 'found' && response.renditions?.length) {
                    setPdfUrl(response.renditions[0]);
                    setIsConverting(false);
                } else if (response.status === 'failed') {
                    setError(t('store.pdfConversionFailed'));
                    setIsConverting(false);
                }
            } catch (err) {
                console.error('Failed to convert Office document to PDF:', err);
                setError(t('store.failedToConvertToPdf'));
                setIsConverting(false);
            }
        };

        await pollForPdf(true);
    }, [objectId, enabled, isConverting, client, t]);

    return {
        pdfUrl,
        isConverting,
        error,
        triggerConversion,
    };
}
