import {
    cloneSemanticallyValidAcceptedOutputFragment,
    conversationOutputReceiptsEqual,
} from '@llumiverse/conversation/output-runtime';
import type {
    ConversationOutputAsset,
    ConversationOutputBlock,
    ConversationOutputReceipt,
    ExperimentalCanonicalInteractionConversationReference,
    ExperimentalCanonicalInteractionExecutionResult,
    ExperimentalCanonicalInteractionInitialState,
} from '@vertesia/common';

type AcceptedOutput = Extract<ExperimentalCanonicalInteractionExecutionResult['output'], { status: 'accepted' }>;
export type CanonicalInteractionOutputFragment = AcceptedOutput['fragment'];
export type CanonicalInteractionOutputBlock = CanonicalInteractionOutputFragment['turn']['blocks'][number];
export type CanonicalInteractionMediaBlock = Extract<
    CanonicalInteractionOutputBlock,
    { type: 'image' | 'document' | 'audio' | 'video' }
>;

export interface CanonicalInteractionMedia<T extends CanonicalInteractionMediaBlock = CanonicalInteractionMediaBlock> {
    block: T;
    asset: ConversationOutputAsset;
}

type CanonicalReferenceInitialState = Extract<ExperimentalCanonicalInteractionInitialState, { type: 'reference' }>;

/** Return the exact server-owned reference represented by retained DEBUG history. */
export function canonicalReference(
    result: ExperimentalCanonicalInteractionExecutionResult,
): ExperimentalCanonicalInteractionConversationReference {
    if (result.run.retention !== 'DEBUG') {
        throw new Error('Canonical interaction result does not contain DEBUG-retained history');
    }
    if (result.history.status === 'reference') {
        if (result.history.reference.run_id !== result.run.id) {
            throw new Error('Canonical interaction history reference does not match the result run');
        }
        return structuredClone(result.history.reference);
    }
    if (result.history.status === 'document') {
        return {
            run_id: result.run.id,
            conversation: {
                conversation_id: result.history.conversation.id,
                revision: result.history.conversation.revision,
            },
        };
    }
    throw new Error('Canonical interaction result does not contain retained canonical history');
}

/** Build a linear continuation state from an actual server-retained reference or document. */
export function referenceInitialState(
    result: ExperimentalCanonicalInteractionExecutionResult,
    operationId: string,
): CanonicalReferenceInitialState {
    return {
        type: 'reference',
        reference: canonicalReference(result),
        operation_id: operationId,
    };
}

/** Read-only conveniences over canonical accepted output; no legacy CompletionResult projection. */
export class CanonicalInteractionOutput<T = unknown> {
    readonly fragment: CanonicalInteractionOutputFragment;

    constructor(fragment: CanonicalInteractionOutputFragment) {
        this.fragment = cloneSemanticallyValidAcceptedOutputFragment(fragment);
    }

    get blocks(): readonly ConversationOutputBlock[] {
        return this.fragment.turn.blocks;
    }

    get isEmpty(): boolean {
        return this.blocks.length === 0;
    }

    matchesReceipt(receipt: ConversationOutputReceipt): boolean {
        return conversationOutputReceiptsEqual(this.fragment.receipt, receipt);
    }

    texts(): string[] {
        return this.blocks.flatMap((block) => (block.type === 'text' ? [block.text] : []));
    }

    text(delimiter = '\n'): string {
        return this.texts().join(delimiter);
    }

    reasoningParts(): string[] {
        return this.blocks.flatMap((block) => (block.type === 'reasoning' ? [block.text] : []));
    }

    reasoning(delimiter = '\n'): string {
        return this.reasoningParts().join(delimiter);
    }

    objects<U = T>(): U[] {
        return this.blocks.flatMap((block) => (block.type === 'json' ? [block.value as U] : []));
    }

    object<U = T>(): U {
        const value = this.objects<U>()[0];
        if (value === undefined) throw new Error('No canonical JSON output block found');
        return value;
    }

    toolCalls() {
        return this.blocks.filter((block) => block.type === 'tool_call');
    }

    asset(id: string): ConversationOutputAsset {
        if (!Object.hasOwn(this.fragment.assets, id)) throw new Error(`Canonical output asset ${id} not found`);
        return this.fragment.assets[id];
    }

    media<TMedia extends CanonicalInteractionMediaBlock['type']>(
        type: TMedia,
    ): CanonicalInteractionMedia<Extract<CanonicalInteractionMediaBlock, { type: TMedia }>>[] {
        return this.blocks.flatMap((block) => {
            if (block.type !== type || !('asset_id' in block)) return [];
            const typedBlock = block as Extract<CanonicalInteractionMediaBlock, { type: TMedia }>;
            return [{ block: typedBlock, asset: this.asset(typedBlock.asset_id) }];
        });
    }

    images() {
        return this.media('image');
    }

    documents() {
        return this.media('document');
    }

    audios() {
        return this.media('audio');
    }

    videos() {
        return this.media('video');
    }
}

export type EnhancedExperimentalCanonicalInteractionExecutionResult<T = unknown> =
    ExperimentalCanonicalInteractionExecutionResult & {
        canonicalOutput?: CanonicalInteractionOutput<T>;
    };

export function enhanceExperimentalCanonicalInteractionExecutionResult<T = unknown>(
    result: ExperimentalCanonicalInteractionExecutionResult,
): EnhancedExperimentalCanonicalInteractionExecutionResult<T> {
    if (result.output.status !== 'accepted') return result;
    const canonicalOutput = new CanonicalInteractionOutput<T>(result.output.fragment);
    return {
        ...result,
        output: { ...result.output, fragment: canonicalOutput.fragment },
        canonicalOutput,
    };
}
