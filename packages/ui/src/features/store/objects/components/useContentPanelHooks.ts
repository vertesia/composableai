import { DocAnalyzerProgress, DocProcessorOutputFormat, MarkdownRenditionFormat, WorkflowExecutionStatus } from "@vertesia/common";
import { useUserSession } from "@vertesia/ui/session";
import { useCallback, useEffect, useState } from "react";
import { i18nInstance, NAMESPACE } from '../../../../i18n/instance.js';

// Maximum text size before cropping (128K characters)
const MAX_TEXT_DISPLAY_SIZE = 128 * 1024;

/**
 * Hook for managing object text loading and cropping.
 */
export function useObjectText(objectId: string, initialText?: string, loadOnMount = false) {
    const { store } = useUserSession();

    const [fullText, setFullText] = useState<string | undefined>(initialText);
    const [displayText, setDisplayText] = useState<string | undefined>(() => {
        if (initialText && initialText.length > MAX_TEXT_DISPLAY_SIZE) {
            return initialText.substring(0, MAX_TEXT_DISPLAY_SIZE);
        }
        return initialText;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isCropped, setIsCropped] = useState(
        () => !!initialText && initialText.length > MAX_TEXT_DISPLAY_SIZE
    );

    const loadText = useCallback(() => {
        setIsLoading(true);
        store.objects
            .getObjectText(objectId)
            .then((res) => {
                setFullText(res.text);
                if (res.text && res.text.length > MAX_TEXT_DISPLAY_SIZE) {
                    setDisplayText(res.text.substring(0, MAX_TEXT_DISPLAY_SIZE));
                    setIsCropped(true);
                } else {
                    setDisplayText(res.text);
                    setIsCropped(false);
                }
            })
            .catch((err) => {
                console.error("Failed to load text", err);
                setFullText(undefined);
                setDisplayText(undefined);
                setIsCropped(false);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [objectId, store]);

    // Reset state when objectId changes
    useEffect(() => {
        // Reset to initial text for new object
        if (initialText && initialText.length > MAX_TEXT_DISPLAY_SIZE) {
            setFullText(initialText);
            setDisplayText(initialText.substring(0, MAX_TEXT_DISPLAY_SIZE));
            setIsCropped(true);
        } else {
            setFullText(initialText);
            setDisplayText(initialText);
            setIsCropped(false);
        }

        // Load text if requested
        if (loadOnMount && !initialText) {
            loadText();
        }
    }, [objectId, initialText, loadOnMount, loadText]);

    return {
        fullText,
        displayText,
        isLoading,
        isCropped,
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
        outputFormat?: DocProcessorOutputFormat;
        isComplete: boolean;
    }>({ isComplete: false });

    useEffect(() => {
        if (!shouldPoll) return;

        let interrupted = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const updateStateIfChanged = (
            nextProgress: DocAnalyzerProgress | undefined,
            nextStatus: WorkflowExecutionStatus | undefined,
            nextOutputFormat: DocProcessorOutputFormat | undefined,
            nextIsComplete: boolean,
        ) => {
            setState((prev) => {
                const prevProgress = JSON.stringify(prev.progress ?? null);
                const nextProgressSignature = JSON.stringify(nextProgress ?? null);

                if (
                    prev.status === nextStatus
                    && prev.outputFormat === nextOutputFormat
                    && prev.isComplete === nextIsComplete
                    && prevProgress === nextProgressSignature
                ) {
                    return prev;
                }

                return {
                    progress: nextProgress,
                    status: nextStatus,
                    outputFormat: nextOutputFormat,
                    isComplete: nextIsComplete,
                };
            });
        };

        function poll() {
            if (interrupted) return;

            client.objects.analyze(objectId).getStatus()
                .then((r) => {
                    const nextOutputFormat = r.output_format ?? r.progress?.output_format;

                    if (r.status === WorkflowExecutionStatus.RUNNING) {
                        updateStateIfChanged(r.progress, r.status, nextOutputFormat, false);
                        // Workflow is running, poll every 2 seconds for progress
                        if (!interrupted) {
                            timeoutId = setTimeout(poll, 2000);
                        }
                    } else {
                        // Workflow completed or terminal state
                        updateStateIfChanged(r.progress, r.status, nextOutputFormat, true);
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
        outputFormat: state.outputFormat,
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

                if (response.status === "generating") {
                    // Poll every 5 seconds
                    setTimeout(() => pollForPdf(false), 5000);
                } else if (response.status === "found" && response.renditions?.length) {
                    setPdfUrl(response.renditions[0]);
                    setIsConverting(false);
                } else if (response.status === "failed") {
                    setError(t('store.pdfConversionFailed'));
                    setIsConverting(false);
                }
            } catch (err) {
                console.error("Failed to convert Office document to PDF:", err);
                setError(t('store.failedToConvertToPdf'));
                setIsConverting(false);
            }
        };

        await pollForPdf(true);
    }, [objectId, enabled, isConverting, client]);

    return {
        pdfUrl,
        isConverting,
        error,
        triggerConversion,
    };
}
