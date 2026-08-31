import type { ContentObjectItemApiResponse } from '@vertesia/common';
import { asRecord, readString } from './memoryRecordReaders.js';

export type MemoryBrainStatus = 'draft' | 'building' | 'active' | 'paused' | 'degraded' | 'archived';

/**
 * One isolated reconstruction. Relationship and content-memory records carry the `brain_id` of the
 * brain that produced them; entities and sources are shared across brains.
 */
export interface MemoryBrain {
    brainId: string;
    displayName: string;
    model: string;
    reasoningEffort?: string;
    partitionField?: string;
    partitionInterval?: string;
    partitionOrder?: string;
    /** Reconstruction generation, surfaced in the status footer. */
    generation?: string;
    lastRunId?: string;
    status: MemoryBrainStatus;
}

const BRAIN_STATUSES: MemoryBrainStatus[] = ['draft', 'building', 'active', 'paused', 'degraded', 'archived'];

function readBrainStatus(record: Record<string, unknown>): MemoryBrainStatus {
    const status = readString(record, 'status');
    return BRAIN_STATUSES.find((candidate) => candidate === status) ?? 'draft';
}

function readGeneration(record: Record<string, unknown>): string | undefined {
    const value = record.generation;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return readString(record, 'generation');
}

export function parseMemoryBrains(records: ContentObjectItemApiResponse[]): MemoryBrain[] {
    return records.flatMap((record) => {
        const properties = asRecord(record.properties);
        const brainId = readString(properties, 'brain_id');
        const model = readString(properties, 'model');
        if (!brainId || !model) return [];
        return [
            {
                brainId,
                displayName: readString(properties, 'display_name') ?? record.name ?? brainId,
                model,
                reasoningEffort: readString(properties, 'reasoning_effort'),
                partitionField: readString(properties, 'partition_field'),
                partitionInterval: readString(properties, 'partition_interval'),
                partitionOrder: readString(properties, 'partition_order'),
                generation: readGeneration(properties),
                lastRunId: readString(properties, 'last_run_id'),
                status: readBrainStatus(properties),
            },
        ];
    });
}

/** Honor an explicitly requested brain, otherwise prefer an active one, otherwise the first. */
export function selectMemoryBrain(brains: MemoryBrain[], requestedBrainId?: string): MemoryBrain | undefined {
    if (requestedBrainId) {
        const requested = brains.find((brain) => brain.brainId === requestedBrainId);
        if (requested) return requested;
    }
    return brains.find((brain) => brain.status === 'active') ?? brains[0];
}

/**
 * Presentation order of the brain statuses.
 *
 * The catalog cards and the explorer's brain selector share it so the two lists can never disagree
 * about which brain comes first.
 */
export const MEMORY_BRAIN_STATUS_ORDER: Record<MemoryBrainStatus, number> = {
    active: 0,
    building: 1,
    draft: 2,
    paused: 3,
    degraded: 4,
    archived: 5,
};

/** Semantic tone a brain status renders with. Shared so every surface colors a status alike. */
export type MemoryBrainStatusTone = 'attention' | 'destructive' | 'done' | 'info' | 'secondary' | 'success';

export function memoryBrainStatusTone(status: MemoryBrainStatus): MemoryBrainStatusTone {
    switch (status) {
        case 'active':
            return 'success';
        case 'building':
            return 'info';
        case 'paused':
            return 'attention';
        case 'degraded':
            return 'destructive';
        case 'archived':
            return 'done';
        default:
            return 'secondary';
    }
}

/** Brains ordered by status, then by display name. Never mutates the input. */
export function sortMemoryBrains(brains: MemoryBrain[]): MemoryBrain[] {
    return [...brains].sort(
        (left, right) =>
            MEMORY_BRAIN_STATUS_ORDER[left.status] - MEMORY_BRAIN_STATUS_ORDER[right.status] ||
            left.displayName.localeCompare(right.displayName),
    );
}

/** Elasticsearch DSL filter scoping reconstructed records to one brain. */
export function buildMemoryBrainFilter(brain: Pick<MemoryBrain, 'brainId'>): Record<string, unknown> {
    return {
        term: { 'properties.brain_id': brain.brainId },
    };
}

/** `provider/model-name` → `model-name`, which is what fits in a badge. */
export function formatModelName(model: string): string {
    return model.split('/').at(-1) ?? model;
}
