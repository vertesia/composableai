import { describe, it, expect } from 'vitest';
import {
    AgentMessageType,
    AgentMessage,
    CompactMessage,
    normalizeMessageType,
    toCompactMessage,
    toAgentMessage,
    parseMessage,
    isCompactMessage,
    isLegacyMessage,
    createCompactMessage,
} from './workflow.js';

describe('CompactMessage converters', () => {
    describe('normalizeMessageType', () => {
        it('handles integer values (current format)', () => {
            expect(normalizeMessageType(0)).toBe(AgentMessageType.SYSTEM);
            expect(normalizeMessageType(1)).toBe(AgentMessageType.THOUGHT);
            expect(normalizeMessageType(2)).toBe(AgentMessageType.PLAN);
            expect(normalizeMessageType(3)).toBe(AgentMessageType.UPDATE);
            expect(normalizeMessageType(4)).toBe(AgentMessageType.COMPLETE);
            expect(normalizeMessageType(5)).toBe(AgentMessageType.WARNING);
            expect(normalizeMessageType(6)).toBe(AgentMessageType.ERROR);
            expect(normalizeMessageType(7)).toBe(AgentMessageType.ANSWER);
            expect(normalizeMessageType(8)).toBe(AgentMessageType.QUESTION);
            expect(normalizeMessageType(9)).toBe(AgentMessageType.REQUEST_INPUT);
            expect(normalizeMessageType(10)).toBe(AgentMessageType.IDLE);
            expect(normalizeMessageType(11)).toBe(AgentMessageType.TERMINATED);
            expect(normalizeMessageType(12)).toBe(AgentMessageType.STREAMING_CHUNK);
            expect(normalizeMessageType(13)).toBe(AgentMessageType.BATCH_PROGRESS);
        });

        it('handles string values (legacy format)', () => {
            expect(normalizeMessageType('system')).toBe(AgentMessageType.SYSTEM);
            expect(normalizeMessageType('thought')).toBe(AgentMessageType.THOUGHT);
            expect(normalizeMessageType('plan')).toBe(AgentMessageType.PLAN);
            expect(normalizeMessageType('update')).toBe(AgentMessageType.UPDATE);
            expect(normalizeMessageType('complete')).toBe(AgentMessageType.COMPLETE);
            expect(normalizeMessageType('warning')).toBe(AgentMessageType.WARNING);
            expect(normalizeMessageType('error')).toBe(AgentMessageType.ERROR);
            expect(normalizeMessageType('answer')).toBe(AgentMessageType.ANSWER);
            expect(normalizeMessageType('question')).toBe(AgentMessageType.QUESTION);
            expect(normalizeMessageType('request_input')).toBe(AgentMessageType.REQUEST_INPUT);
            expect(normalizeMessageType('idle')).toBe(AgentMessageType.IDLE);
            expect(normalizeMessageType('terminated')).toBe(AgentMessageType.TERMINATED);
            expect(normalizeMessageType('streaming_chunk')).toBe(AgentMessageType.STREAMING_CHUNK);
            expect(normalizeMessageType('batch_progress')).toBe(AgentMessageType.BATCH_PROGRESS);
        });

        it('handles AgentMessageType enum values', () => {
            expect(normalizeMessageType(AgentMessageType.SYSTEM)).toBe(AgentMessageType.SYSTEM);
            expect(normalizeMessageType(AgentMessageType.ERROR)).toBe(AgentMessageType.ERROR);
            expect(normalizeMessageType(AgentMessageType.ANSWER)).toBe(AgentMessageType.ANSWER);
        });

        it('returns UPDATE for unknown values', () => {
            expect(normalizeMessageType(999)).toBe(AgentMessageType.UPDATE);
            expect(normalizeMessageType('unknown')).toBe(AgentMessageType.UPDATE);
        });
    });

    describe('isCompactMessage', () => {
        it('returns true for compact messages', () => {
            expect(isCompactMessage({ t: AgentMessageType.UPDATE })).toBe(true);
            expect(isCompactMessage({ t: 0, m: 'test' })).toBe(true);
        });

        it('returns false for non-compact messages', () => {
            expect(isCompactMessage({ type: AgentMessageType.UPDATE })).toBe(false);
            expect(isCompactMessage(null)).toBe(false);
            expect(isCompactMessage(undefined)).toBe(false);
            expect(isCompactMessage('string')).toBe(false);
            expect(isCompactMessage(123)).toBe(false);
        });
    });

    describe('isLegacyMessage', () => {
        it('returns true for legacy messages', () => {
            expect(isLegacyMessage({ type: AgentMessageType.UPDATE })).toBe(true);
            expect(isLegacyMessage({
                type: AgentMessageType.ANSWER,
                timestamp: 12345,
                workflow_run_id: 'run-1',
                message: 'test'
            })).toBe(true);
        });

        it('returns false for compact messages', () => {
            expect(isLegacyMessage({ t: AgentMessageType.UPDATE })).toBe(false);
            // Has both type and t - compact takes precedence
            expect(isLegacyMessage({ type: AgentMessageType.UPDATE, t: AgentMessageType.UPDATE })).toBe(false);
        });

        it('returns false for non-messages', () => {
            expect(isLegacyMessage(null)).toBe(false);
            expect(isLegacyMessage(undefined)).toBe(false);
            expect(isLegacyMessage({})).toBe(false);
        });
    });

    describe('toCompactMessage', () => {
        it('converts basic legacy message', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.UPDATE,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'Test message',
            };

            const compact = toCompactMessage(legacy);

            expect(compact.t).toBe(AgentMessageType.UPDATE);
            expect(compact.m).toBe('Test message');
            expect(compact.ts).toBe(1234567890);
            expect(compact.w).toBeUndefined(); // main is default, not included
        });

        it('includes workstream_id when not main', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.THOUGHT,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'Thinking...',
                workstream_id: 'research',
            };

            const compact = toCompactMessage(legacy);

            expect(compact.w).toBe('research');
        });

        it('excludes workstream_id when main', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.UPDATE,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'Update',
                workstream_id: 'main',
            };

            const compact = toCompactMessage(legacy);

            expect(compact.w).toBeUndefined();
        });

        it('includes details for non-streaming messages', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.PLAN,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'Plan created',
                details: { plan: [{ id: 1, goal: 'Step 1' }] },
            };

            const compact = toCompactMessage(legacy);

            expect(compact.d).toEqual({ plan: [{ id: 1, goal: 'Step 1' }] });
        });

        it('handles streaming chunk with is_final flag', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.STREAMING_CHUNK,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'chunk content',
                details: {
                    streaming_id: 'stream-1',
                    chunk_index: 5,
                    is_final: true,
                },
            };

            const compact = toCompactMessage(legacy);

            expect(compact.t).toBe(AgentMessageType.STREAMING_CHUNK);
            expect(compact.m).toBe('chunk content');
            expect(compact.f).toBe(1);
            expect(compact.d).toBeUndefined(); // streaming_id and chunk_index removed
        });

        it('handles streaming chunk without is_final', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.STREAMING_CHUNK,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'chunk content',
                details: {
                    streaming_id: 'stream-1',
                    chunk_index: 2,
                    is_final: false,
                },
            };

            const compact = toCompactMessage(legacy);

            expect(compact.f).toBeUndefined();
        });

        it('normalizes legacy string type values', () => {
            // Simulate a message from Redis with old string type
            const legacy = {
                type: 'answer' as unknown as AgentMessageType,
                timestamp: 1234567890,
                workflow_run_id: 'run-123',
                message: 'Response',
            };

            const compact = toCompactMessage(legacy);

            expect(compact.t).toBe(AgentMessageType.ANSWER);
        });

        it('omits empty/undefined fields', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.IDLE,
                timestamp: 0,
                workflow_run_id: 'run-123',
                message: '',
            };

            const compact = toCompactMessage(legacy);

            expect(compact).toEqual({ t: AgentMessageType.IDLE });
            expect(Object.keys(compact)).toEqual(['t']);
        });
    });

    describe('toAgentMessage', () => {
        it('converts compact message to legacy format', () => {
            const compact: CompactMessage = {
                t: AgentMessageType.ANSWER,
                m: 'Hello world',
                ts: 1234567890,
            };

            const legacy = toAgentMessage(compact, 'run-456');

            expect(legacy.type).toBe(AgentMessageType.ANSWER);
            expect(legacy.message).toBe('Hello world');
            expect(legacy.timestamp).toBe(1234567890);
            expect(legacy.workflow_run_id).toBe('run-456');
            expect(legacy.workstream_id).toBe('main');
        });

        it('restores workstream_id', () => {
            const compact: CompactMessage = {
                t: AgentMessageType.UPDATE,
                m: 'Working...',
                w: 'analysis',
            };

            const legacy = toAgentMessage(compact, 'run-789');

            expect(legacy.workstream_id).toBe('analysis');
        });

        it('provides defaults for missing fields', () => {
            const compact: CompactMessage = {
                t: AgentMessageType.SYSTEM,
            };

            const legacy = toAgentMessage(compact);

            expect(legacy.message).toBe('');
            expect(legacy.workflow_run_id).toBe('');
            expect(legacy.workstream_id).toBe('main');
            expect(legacy.timestamp).toBeGreaterThan(0); // Uses Date.now()
        });

        it('restores details', () => {
            const compact: CompactMessage = {
                t: AgentMessageType.BATCH_PROGRESS,
                m: 'Processing batch',
                d: { batch_id: 'batch-1', completed: 5, total: 10 },
            };

            const legacy = toAgentMessage(compact, 'run-1');

            expect(legacy.details).toEqual({ batch_id: 'batch-1', completed: 5, total: 10 });
        });

        it('restores streaming chunk details with is_final', () => {
            const compact: CompactMessage = {
                t: AgentMessageType.STREAMING_CHUNK,
                m: 'chunk text',
                w: 'stream-workstream',
                f: 1,
            };

            const legacy = toAgentMessage(compact, 'run-1');

            expect(legacy.details).toEqual({
                streaming_id: 'stream-workstream',
                is_final: true,
            });
        });

        it('restores streaming chunk details without is_final', () => {
            const compact: CompactMessage = {
                t: AgentMessageType.STREAMING_CHUNK,
                m: 'chunk text',
            };

            const legacy = toAgentMessage(compact, 'run-1');

            expect(legacy.details).toEqual({
                streaming_id: 'main',
                is_final: false,
            });
        });
    });

    describe('parseMessage', () => {
        it('parses compact message from object', () => {
            const input: CompactMessage = { t: AgentMessageType.UPDATE, m: 'Test' };

            const result = parseMessage(input);

            expect(result).toEqual(input);
        });

        it('parses compact message from JSON string', () => {
            const input = JSON.stringify({ t: AgentMessageType.ERROR, m: 'Error occurred' });

            const result = parseMessage(input);

            expect(result.t).toBe(AgentMessageType.ERROR);
            expect(result.m).toBe('Error occurred');
        });

        it('converts legacy message object to compact', () => {
            const legacy: AgentMessage = {
                type: AgentMessageType.COMPLETE,
                timestamp: 1234567890,
                workflow_run_id: 'run-1',
                message: 'Done!',
            };

            const result = parseMessage(legacy);

            expect(isCompactMessage(result)).toBe(true);
            expect(result.t).toBe(AgentMessageType.COMPLETE);
            expect(result.m).toBe('Done!');
        });

        it('converts legacy message JSON string to compact', () => {
            const legacy = JSON.stringify({
                type: AgentMessageType.WARNING,
                timestamp: 1234567890,
                workflow_run_id: 'run-1',
                message: 'Warning message',
            });

            const result = parseMessage(legacy);

            expect(isCompactMessage(result)).toBe(true);
            expect(result.t).toBe(AgentMessageType.WARNING);
        });

        it('throws error for unknown format', () => {
            expect(() => parseMessage({})).toThrow('Unknown message format');
            expect(() => parseMessage({ foo: 'bar' })).toThrow('Unknown message format');
        });

        it('throws error for invalid JSON', () => {
            expect(() => parseMessage('not json')).toThrow();
        });
    });

    describe('createCompactMessage', () => {
        it('creates minimal compact message', () => {
            const msg = createCompactMessage(AgentMessageType.IDLE);

            expect(msg).toEqual({ t: AgentMessageType.IDLE });
        });

        it('creates compact message with all options', () => {
            const msg = createCompactMessage(AgentMessageType.PLAN, {
                message: 'Plan created',
                workstreamId: 'planning',
                details: { steps: 5 },
                timestamp: 1234567890,
            });

            expect(msg).toEqual({
                t: AgentMessageType.PLAN,
                m: 'Plan created',
                w: 'planning',
                d: { steps: 5 },
                ts: 1234567890,
            });
        });

        it('excludes workstreamId when main', () => {
            const msg = createCompactMessage(AgentMessageType.UPDATE, {
                message: 'Update',
                workstreamId: 'main',
            });

            expect(msg.w).toBeUndefined();
        });

        it('sets is_final flag for streaming chunks', () => {
            const msg = createCompactMessage(AgentMessageType.STREAMING_CHUNK, {
                message: 'final chunk',
                isFinal: true,
            });

            expect(msg.f).toBe(1);
        });
    });

    describe('round-trip conversion', () => {
        it('legacy -> compact -> legacy preserves essential data', () => {
            const original: AgentMessage = {
                type: AgentMessageType.ANSWER,
                timestamp: 1234567890,
                workflow_run_id: 'run-abc',
                message: 'This is a long response from the AI assistant.',
                workstream_id: 'conversation',
                details: { sources: ['doc1', 'doc2'] },
            };

            const compact = toCompactMessage(original);
            const restored = toAgentMessage(compact, original.workflow_run_id);

            expect(restored.type).toBe(original.type);
            expect(restored.timestamp).toBe(original.timestamp);
            expect(restored.workflow_run_id).toBe(original.workflow_run_id);
            expect(restored.message).toBe(original.message);
            expect(restored.workstream_id).toBe(original.workstream_id);
            expect(restored.details).toEqual(original.details);
        });

        it('compact -> legacy -> compact preserves essential data', () => {
            const original: CompactMessage = {
                t: AgentMessageType.THOUGHT,
                m: 'Analyzing the problem...',
                w: 'reasoning',
                d: { confidence: 0.85 },
                ts: 1234567890,
            };

            const legacy = toAgentMessage(original, 'run-xyz');
            const restored = toCompactMessage(legacy);

            expect(restored.t).toBe(original.t);
            expect(restored.m).toBe(original.m);
            expect(restored.w).toBe(original.w);
            expect(restored.d).toEqual(original.d);
            expect(restored.ts).toBe(original.ts);
        });

        it('handles all message types in round-trip', () => {
            const messageTypes = [
                AgentMessageType.SYSTEM,
                AgentMessageType.THOUGHT,
                AgentMessageType.PLAN,
                AgentMessageType.UPDATE,
                AgentMessageType.COMPLETE,
                AgentMessageType.WARNING,
                AgentMessageType.ERROR,
                AgentMessageType.ANSWER,
                AgentMessageType.QUESTION,
                AgentMessageType.REQUEST_INPUT,
                AgentMessageType.IDLE,
                AgentMessageType.TERMINATED,
                AgentMessageType.BATCH_PROGRESS,
            ];

            for (const type of messageTypes) {
                const original: AgentMessage = {
                    type,
                    timestamp: 1234567890,
                    workflow_run_id: 'run-test',
                    message: `Test message for type ${type}`,
                };

                const compact = toCompactMessage(original);
                const restored = toAgentMessage(compact, original.workflow_run_id);

                expect(restored.type).toBe(type);
                expect(restored.message).toBe(original.message);
            }
        });

        it('streaming chunk round-trip preserves is_final', () => {
            const original: AgentMessage = {
                type: AgentMessageType.STREAMING_CHUNK,
                timestamp: 1234567890,
                workflow_run_id: 'run-stream',
                message: 'Final chunk content',
                workstream_id: 'stream-1',
                details: {
                    streaming_id: 'stream-1',
                    chunk_index: 10,
                    is_final: true,
                },
            };

            const compact = toCompactMessage(original);
            const restored = toAgentMessage(compact, original.workflow_run_id);

            expect(restored.type).toBe(AgentMessageType.STREAMING_CHUNK);
            expect(restored.details?.is_final).toBe(true);
            expect(restored.details?.streaming_id).toBe(original.workstream_id);
        });
    });

    describe('edge cases', () => {
        it('handles unicode and special characters', () => {
            const original: AgentMessage = {
                type: AgentMessageType.ANSWER,
                timestamp: 1234567890,
                workflow_run_id: 'run-1',
                message: 'Unicode: 你好世界 🎉 émojis & spëcial chars <script>alert(1)</script>',
            };

            const compact = toCompactMessage(original);
            const restored = toAgentMessage(compact, original.workflow_run_id);

            expect(restored.message).toBe(original.message);
        });

        it('handles very long messages', () => {
            const longMessage = 'A'.repeat(100000);
            const original: AgentMessage = {
                type: AgentMessageType.ANSWER,
                timestamp: 1234567890,
                workflow_run_id: 'run-1',
                message: longMessage,
            };

            const compact = toCompactMessage(original);
            const restored = toAgentMessage(compact, original.workflow_run_id);

            expect(restored.message).toBe(longMessage);
            expect(restored.message.length).toBe(100000);
        });

        it('handles null-like values in details', () => {
            const original: AgentMessage = {
                type: AgentMessageType.UPDATE,
                timestamp: 1234567890,
                workflow_run_id: 'run-1',
                message: 'Update',
                details: { value: null, empty: '', zero: 0, bool: false },
            };

            const compact = toCompactMessage(original);
            const restored = toAgentMessage(compact, original.workflow_run_id);

            expect(restored.details).toEqual(original.details);
        });

        it('handles nested object details', () => {
            const original: AgentMessage = {
                type: AgentMessageType.PLAN,
                timestamp: 1234567890,
                workflow_run_id: 'run-1',
                message: 'Plan',
                details: {
                    plan: [
                        { id: 1, goal: 'Step 1', instructions: ['Do this', 'Then that'] },
                        { id: 2, goal: 'Step 2', instructions: ['Final step'] },
                    ],
                    metadata: { version: 1, author: 'agent' },
                },
            };

            const compact = toCompactMessage(original);
            const restored = toAgentMessage(compact, original.workflow_run_id);

            expect(restored.details).toEqual(original.details);
        });
    });
});
