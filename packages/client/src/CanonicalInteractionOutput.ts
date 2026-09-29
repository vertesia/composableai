import { cloneSemanticallyValidAcceptedOutputFragment } from '@llumiverse/conversation/output-runtime';
import type {
    ConversationOutputAsset,
    ConversationOutputBlock,
    ExperimentalCanonicalInteractionExecutionResult,
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
