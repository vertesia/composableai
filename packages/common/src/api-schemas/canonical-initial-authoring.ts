import { ConversationRefSchema, IdentifierSchema } from '@llumiverse/conversation/schemas';
import { z } from 'zod';

/** Targetless authoring capture data. This does not claim that rendered input has been accepted. */
export const ExperimentalCanonicalInitialAuthoringResponseSchema = z
    .strictObject({
        execution_run_id: IdentifierSchema,
        source: ConversationRefSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInitialAuthoringResponse' });
