import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentMessage, AgentMessageType, Plan } from '@vertesia/common';

export interface UseAgentPlansResult {
    plans: Array<{ plan: Plan; timestamp: number }>;
    activePlanIndex: number;
    setActivePlanIndex: (index: number) => void;
    workstreamStatusMap: Map<number, Map<string, 'pending' | 'in_progress' | 'completed' | 'skipped'>>;
    showInput: boolean;
    /** Whether the sliding plan panel should be shown */
    showSlidingPanel: boolean;
    setShowSlidingPanel: (show: boolean | ((prev: boolean) => boolean)) => void;
}

/**
 * Hook that extracts plan detection and workstream status management from messages.
 *
 * Key improvement: incremental processing. Instead of scanning ALL messages
 * on every change, tracks `lastProcessedIndex` and only scans new messages.
 */
export function useAgentPlans(
    messages: AgentMessage[],
    interactive: boolean,
    isModal = false,
): UseAgentPlansResult {
    const [plans, setPlans] = useState<Array<{ plan: Plan; timestamp: number }>>([]);
    const [activePlanIndex, setActivePlanIndex] = useState<number>(0);
    const [workstreamStatusMap, setWorkstreamStatusMap] = useState<
        Map<number, Map<string, 'pending' | 'in_progress' | 'completed' | 'skipped'>>
    >(new Map());
    const [showInput, setShowInput] = useState(interactive);
    const [showSlidingPanel, setShowSlidingPanel] = useState<boolean>(!isModal);

    // Incremental processing: track how far we've scanned
    const lastProcessedIndex = useRef<number>(-1);
    // Track known plan timestamps to avoid re-adding
    const knownPlanTimestamps = useRef<Set<number>>(new Set());

    // Reset when messages are cleared (new run)
    useEffect(() => {
        if (messages.length === 0) {
            setPlans([]);
            setActivePlanIndex(0);
            setWorkstreamStatusMap(new Map());
            setShowSlidingPanel(false);
            lastProcessedIndex.current = -1;
            knownPlanTimestamps.current.clear();
        }
    }, [messages.length === 0]);

    // Process new messages incrementally
    useEffect(() => {
        if (messages.length === 0) return;

        const startIdx = lastProcessedIndex.current + 1;
        if (startIdx >= messages.length) {
            // No new messages to process, but still check showInput from last message
            updateShowInput(messages);
            return;
        }

        let plansChanged = false;
        const newPlansToAdd: Array<{ plan: Plan; timestamp: number }> = [];
        const newWorkstreamUpdates: Array<{
            timestamp: number;
            statusMap: Map<string, 'pending' | 'in_progress' | 'completed' | 'skipped'>;
        }> = [];

        for (let i = startIdx; i < messages.length; i++) {
            const message = messages[i];

            if (message.type === AgentMessageType.PLAN) {
                try {
                    let newPlanDetails: Plan | null = null;

                    if (message.details && typeof message.details === 'object') {
                        if (message.details.plan && Array.isArray(message.details.plan)) {
                            newPlanDetails = { plan: message.details.plan } as Plan;
                        }
                    }

                    if (newPlanDetails) {
                        const timestamp =
                            typeof message.timestamp === 'number'
                                ? message.timestamp
                                : new Date(message.timestamp).getTime();

                        if (!knownPlanTimestamps.current.has(timestamp)) {
                            knownPlanTimestamps.current.add(timestamp);
                            plansChanged = true;

                            newPlansToAdd.push({ plan: newPlanDetails, timestamp });

                            // Initialize workstreams for this plan
                            const newWorkstreamStatus = new Map<
                                string,
                                'pending' | 'in_progress' | 'completed' | 'skipped'
                            >();
                            newWorkstreamStatus.set('main', 'in_progress');

                            if (Array.isArray(newPlanDetails.plan)) {
                                newPlanDetails.plan.forEach((task) => {
                                    if (task && typeof task === 'object' && task.id) {
                                        const taskId = task.id.toString();
                                        newWorkstreamStatus.set(taskId, task.status || 'pending');
                                    }
                                });
                            }

                            newWorkstreamUpdates.push({ timestamp, statusMap: newWorkstreamStatus });
                        }
                    }
                } catch (error) {
                    console.error('Failed to parse plan from message:', error);
                }
            }
        }

        lastProcessedIndex.current = messages.length - 1;

        // Batch state updates
        if (plansChanged && newPlansToAdd.length > 0) {
            setPlans((prev) => {
                // Add newest first
                const reversed = [...newPlansToAdd].reverse();
                return [...reversed, ...prev];
            });
            setActivePlanIndex(0);
            setShowSlidingPanel(true);

            if (newWorkstreamUpdates.length > 0) {
                setWorkstreamStatusMap((prev) => {
                    const newMap = new Map(prev);
                    for (const update of newWorkstreamUpdates) {
                        newMap.set(update.timestamp, update.statusMap);
                    }
                    return newMap;
                });
            }
        }

        updateShowInput(messages);
    }, [messages, interactive]);

    // Auto-show plan panel for the first plan (once only)
    useEffect(() => {
        if (
            plans.length === 1 &&
            !showSlidingPanel &&
            !sessionStorage.getItem('plan-panel-shown')
        ) {
            const notificationTimeout = setTimeout(() => {
                setShowSlidingPanel(true);
                sessionStorage.setItem('plan-panel-shown', 'true');
            }, 500);
            return () => clearTimeout(notificationTimeout);
        }
    }, [plans.length, showSlidingPanel]);

    // Hide panel when there are no plans
    useEffect(() => {
        if (plans.length === 0) {
            setShowSlidingPanel(false);
        }
    }, [plans.length]);

    // Helper to determine showInput from the latest message
    const updateShowInput = useCallback((msgs: AgentMessage[]) => {
        const lastMessage = msgs[msgs.length - 1];
        if (!lastMessage) return;

        if (lastMessage.type === AgentMessageType.TERMINATED) {
            setShowInput(false);
        } else if (interactive) {
            setShowInput(true);
        } else {
            setShowInput(lastMessage.type === AgentMessageType.REQUEST_INPUT);
        }
    }, [interactive]);

    return {
        plans,
        activePlanIndex,
        setActivePlanIndex,
        workstreamStatusMap,
        showInput,
        showSlidingPanel,
        setShowSlidingPanel,
    };
}
