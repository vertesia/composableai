import { type AgentMessage, AgentMessageType, type CompactMessage } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { shouldCloseAgentRunStream, shouldCloseCompactRunStream } from './stream-termination.js';

describe('stream termination', () => {
    const rootRunId = 'root-run';

    it('closes agent streams on the root run completion', () => {
        const message: AgentMessage = {
            type: AgentMessageType.COMPLETE,
            timestamp: Date.now(),
            workflow_run_id: rootRunId,
            message: 'root complete',
            workstream_id: 'main',
            details: {
                process_run_id: rootRunId,
            },
        };

        expect(shouldCloseAgentRunStream(message, rootRunId)).toBe(true);
    });

    it('keeps agent streams open for child process completion on main', () => {
        const message: AgentMessage = {
            type: AgentMessageType.COMPLETE,
            timestamp: Date.now(),
            workflow_run_id: rootRunId,
            message: 'child complete',
            workstream_id: 'main',
            details: {
                process_run_id: 'child-run',
            },
        };

        expect(shouldCloseAgentRunStream(message, rootRunId)).toBe(false);
    });

    it('keeps compact streams open for child process completion on main', () => {
        const message: CompactMessage = {
            t: AgentMessageType.COMPLETE,
            m: 'child complete',
            d: {
                process_run_id: 'child-run',
            },
        };

        expect(shouldCloseCompactRunStream(message, rootRunId)).toBe(false);
    });

    it('still closes streams for main completion without process metadata', () => {
        const message: CompactMessage = {
            t: AgentMessageType.COMPLETE,
            m: 'conversation complete',
        };

        expect(shouldCloseCompactRunStream(message, rootRunId)).toBe(true);
    });

    it('keeps interactive root streams open when the conversation becomes idle', () => {
        const message: AgentMessage = {
            type: AgentMessageType.IDLE,
            timestamp: Date.now(),
            workflow_run_id: rootRunId,
            message: 'Waiting for your command...',
            workstream_id: 'main',
        };

        expect(shouldCloseAgentRunStream(message, rootRunId)).toBe(false);
        expect(shouldCloseAgentRunStream(message, rootRunId, true)).toBe(true);
    });

    it('keeps compact streams open when a child workstream becomes idle', () => {
        const message: CompactMessage = {
            t: AgentMessageType.IDLE,
            m: 'Child waiting',
            w: 'implementation',
        };

        expect(shouldCloseCompactRunStream(message, rootRunId)).toBe(false);
        expect(shouldCloseCompactRunStream(message, rootRunId, true)).toBe(false);
    });
});
