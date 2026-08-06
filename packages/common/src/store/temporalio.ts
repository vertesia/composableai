/**
 * Copied from temporalio: the runtime `ParentClosePolicy` constant.
 *
 * The `ParentClosePolicyType` union it produces is part of the public workflow DSL — clients author
 * `parentClosePolicy` on a child-workflow step — so it is declared in `./dsl-workflow.ts` and
 * imported back here. Only this constant is internal: it exists for workflow-authoring code in the
 * platform's own workers, not for API consumers.
 */
interface ParentClosePolicyI {
    TERMINATE: 'TERMINATE';
    ABANDON: 'ABANDON';
    REQUEST_CANCEL: 'REQUEST_CANCEL';
    PARENT_CLOSE_POLICY_UNSPECIFIED: undefined;
    PARENT_CLOSE_POLICY_TERMINATE: 'TERMINATE';
    PARENT_CLOSE_POLICY_ABANDON: 'ABANDON';
    PARENT_CLOSE_POLICY_REQUEST_CANCEL: 'REQUEST_CANCEL';
}
export const ParentClosePolicy = {
    /**
     * When the Parent is Closed, the Child is Terminated.
     *
     * @default
     */
    TERMINATE: 'TERMINATE',
    /**
     * When the Parent is Closed, nothing is done to the Child.
     */
    ABANDON: 'ABANDON',
    /**
     * When the Parent is Closed, the Child is Cancelled.
     */
    REQUEST_CANCEL: 'REQUEST_CANCEL',
    /**
     * If a `ParentClosePolicy` is set to this, or is not set at all, the server default value will be used.
     *
     * @deprecated Either leave property `undefined`, or set an explicit policy instead.
     */
    PARENT_CLOSE_POLICY_UNSPECIFIED: undefined,
    /**
     * When the Parent is Closed, the Child is Terminated.
     *
     * @deprecated Use {@link ParentClosePolicy.TERMINATE} instead.
     */
    PARENT_CLOSE_POLICY_TERMINATE: 'TERMINATE',
    /**
     * When the Parent is Closed, nothing is done to the Child.
     *
     * @deprecated Use {@link ParentClosePolicy.ABANDON} instead.
     */
    PARENT_CLOSE_POLICY_ABANDON: 'ABANDON',
    /**
     * When the Parent is Closed, the Child is Cancelled.
     *
     * @deprecated Use {@link ParentClosePolicy.REQUEST_CANCEL} instead.
     */
    PARENT_CLOSE_POLICY_REQUEST_CANCEL: 'REQUEST_CANCEL',
} as ParentClosePolicyI;
