import type {
    CreateEventSubscriptionPayload,
    EventDeliveryTarget,
    EventDeliveryTargetInput,
    EventSubscription,
    EventSubscriptionMutationResponse,
    ProcessEventDeliveryTarget,
    UpdateEventSubscriptionPayload,
} from '../platform-event.js';
import type {
    AgentRunInternals,
    AgentRunResponse,
    BindRunWorkflowPayload,
    ListAgentRunsResponse,
    ProgrammaticRunResponse,
    RecordRunPayload,
    SupervisedRunResponse,
    UpdateAgentRunStatusPayload,
} from '../store/agent-run.js';
import type * as DSLWorkflowTypes from '../store/dsl-workflow.js';
import type {
    DSLChildWorkflowStep,
    DSLWorkflowDefinition,
    DSLWorkflowDefinitionResponse,
    DSLWorkflowSpec,
    DSLWorkflowSpecWithSteps,
    DSLWorkflowStep,
} from '../store/dsl-workflow.js';
import type {
    BranchNodeBranchDefinition,
    CreateProcessDefinitionPayload,
    NodeDefinition,
    ProcessDefinition,
    ProcessDefinitionBody,
    UpdateProcessDefinitionPayload,
} from '../store/process.js';
import type { ViewNavigationNode } from '../views.js';
import type { ApiComponentTypes } from '../wire-types.generated.js';

export type ApiComponentName = keyof ApiComponentTypes;

/**
 * Explicit TypeScript recursion boundary for schemas whose runtime graph is lazy.
 *
 * Zod cannot infer a finite named type through a mutually-recursive graph. The schemas remain the
 * runtime and OpenAPI authority; these names preserve the recursive TypeScript declarations until
 * TypeScript can infer recursive aliases without collapsing them to `unknown`.
 */
interface ZenoRecursiveComponentTypes {
    ViewNavigationNode: ViewNavigationNode;
    AgentRunResponse: AgentRunResponse;
    AgentRunInternals: AgentRunInternals;
    BindRunWorkflowPayload: BindRunWorkflowPayload;
    BranchNodeBranchDefinition: BranchNodeBranchDefinition;
    CreateEventSubscriptionPayload: CreateEventSubscriptionPayload;
    CreateProcessDefinitionPayload: CreateProcessDefinitionPayload;
    DSLChildWorkflowStep: DSLChildWorkflowStep;
    DSLWorkflowDefinition: DSLWorkflowDefinition;
    DSLWorkflowDefinitionResponse: DSLWorkflowDefinitionResponse;
    DSLWorkflowSpec: DSLWorkflowSpec;
    DSLWorkflowSpecWithActivities: DSLWorkflowTypes.DSLWorkflowSpecWithActivities;
    DSLWorkflowSpecWithSteps: DSLWorkflowSpecWithSteps;
    DSLWorkflowStep: DSLWorkflowStep;
    EventDeliveryTarget: EventDeliveryTarget;
    EventDeliveryTargetInput: EventDeliveryTargetInput;
    EventSubscription: EventSubscription;
    EventSubscriptionArray: EventSubscription[];
    EventSubscriptionMutationResponse: EventSubscriptionMutationResponse;
    ListAgentRunsResponse: ListAgentRunsResponse;
    NodeDefinition: NodeDefinition;
    NodeDefinitionMap: Record<string, NodeDefinition>;
    ProcessDefinition: ProcessDefinition;
    ProcessDefinitionArray: ProcessDefinition[];
    ProcessDefinitionBody: ProcessDefinitionBody;
    ProcessEventDeliveryTarget: ProcessEventDeliveryTarget;
    ProgrammaticRunResponse: ProgrammaticRunResponse;
    RecordRunPayload: RecordRunPayload;
    SupervisedRunResponse: SupervisedRunResponse;
    UpdateAgentRunStatusPayload: UpdateAgentRunStatusPayload;
    UpdateEventSubscriptionPayload: UpdateEventSubscriptionPayload;
    UpdateProcessDefinitionPayload: UpdateProcessDefinitionPayload;
    WorkflowDefinitionPayload: DSLWorkflowTypes.WorkflowDefinitionPayload;
    WorkflowDefinitionPayloadWithActivities: DSLWorkflowTypes.WorkflowDefinitionPayloadWithActivities;
    WorkflowDefinitionPayloadWithSteps: DSLWorkflowTypes.WorkflowDefinitionPayloadWithSteps;
}

/**
 * The wire type a component publishes.
 *
 * `ApiComponentType<'Account'>` is the plain type `gen:schemas` writes for `AccountSchema` into
 * `ApiComponentTypes`, which `wire-types.generated.test.ts` proves identical to its `z.infer`. Indexing
 * that map rather than `z.infer<ApiSchemaMap[N]>` keeps Zod's inference out of every program that names
 * a component. A component the generator has not seen yet resolves to `never`, which
 * `registry-groups.test.ts` rejects.
 *
 * It is wrapped in `NoInfer` because `N` always comes from a component-name argument and can never be
 * recovered from the wire type. Without it, a call whose result has a contextual type — a destructuring
 * `const { file } = validatedQuery(ctx, 'FileMetadataQuery')`, an `await`, a typed `return` — makes the
 * checker infer `N` from that context while `N` is still unresolved, which evaluates `z.infer` across
 * every component in the registry: about 500k types, 1 GB and 2 s of `tsc` in each consuming program.
 */
export type ApiComponentType<N extends ApiComponentName> = NoInfer<
    N extends keyof ZenoRecursiveComponentTypes
        ? ZenoRecursiveComponentTypes[N]
        : N extends keyof ApiComponentTypes
          ? ApiComponentTypes[N]
          : never
>;
