/**
 * Runtime values the agent-run API schemas build on.
 *
 * Split out of `agent-run.ts` for the reason `account-values.ts` was split out of `user.ts`: the
 * schema module in `api-schemas/` needs these at runtime, while `agent-run.ts` must stay a
 * type-only module so importing it never pulls Zod into a consumer's bundle. Both sides import
 * from here, and `agent-run.ts` re-exports it so the constants are nameable from the package root.
 */

/**
 * Bound on `AgentRunFeedbackPayload.comment`, in characters.
 *
 * Published so a client can stop the user at the limit instead of letting the server reject the
 * whole rating over the tail of a comment.
 */
export const AGENT_RUN_FEEDBACK_COMMENT_MAX_LENGTH = 2000;

/**
 * Bound on `AgentRunFeedbackPayload.feedback_id`, in characters. A UUID fits comfortably.
 */
export const AGENT_RUN_FEEDBACK_ID_MAX_LENGTH = 64;

/**
 * How many feedback entries a run retains. Counters are computed over the retained entries;
 * replaced entries are evicted first, then the oldest.
 */
export const AGENT_RUN_FEEDBACK_MAX_ENTRIES = 50;
