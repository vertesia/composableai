import type { EmbeddingsResult } from '@llumiverse/common';
import type { z } from 'zod';
import type {
    EmbeddingsApiAudioInputSchema,
    EmbeddingsApiImageInputSchema,
    EmbeddingsApiInputSchema,
    EmbeddingsApiRequestSchema,
    EmbeddingsApiSourceSchema,
    EmbeddingsApiTextInputSchema,
    EmbeddingsApiVideoInputSchema,
} from './api-schemas/embeddings.js';

/**
 * The embeddings request types, inferred from `./api-schemas/embeddings.js`. Their documentation
 * moved with them: a doc comment above one of these would be published on top of the schema's own
 * `description`, which is how the union's description came to be the truncated `"…Mirror of"` the
 * document carried until wave S2.
 */
export type EmbeddingsApiInput = z.infer<typeof EmbeddingsApiInputSchema>;

export type EmbeddingsApiSource = z.infer<typeof EmbeddingsApiSourceSchema>;

export type EmbeddingsApiTextInput = z.infer<typeof EmbeddingsApiTextInputSchema>;

export type EmbeddingsApiImageInput = z.infer<typeof EmbeddingsApiImageInputSchema>;

export type EmbeddingsApiVideoInput = z.infer<typeof EmbeddingsApiVideoInputSchema>;

export type EmbeddingsApiAudioInput = z.infer<typeof EmbeddingsApiAudioInputSchema>;

export type EmbeddingsApiRequest = z.infer<typeof EmbeddingsApiRequestSchema>;

/**
 * Wire-format result. Identical to @llumiverse/common's EmbeddingsResult
 * (vectors and metadata are JSON-friendly), re-exported here for callers
 * that prefer to consume types from @vertesia/common.
 */
export type EmbeddingsApiResult = EmbeddingsResult;
