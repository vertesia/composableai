import { ContentEventName, WorkflowExecutionPayload } from '@vertesia/common';
import { ActivityExecutionPayload, ExampleWorkflowParams } from '../activities.js';

/**
 * Creates a mock activity payload for testing.
 *
 * @param params - The activity-specific parameters
 * @returns A complete ActivityExecutionPayload for use in tests
 */
export const getMockActivityPayload = <T>(params: T): ActivityExecutionPayload<T> => {
    return {
        event: ContentEventName.workflow_execution_request,
        objectIds: ['test-object-id'],
        auth_token: 'mock-auth-token',
        account_id: 'mock-account-id',
        project_id: 'mock-project-id',
        config: {
            studio_url: 'http://mock-studio',
            store_url: 'http://mock-store',
        },
        vars: {},
        params: params,
    };
};

/**
 * Creates a mock workflow payload for testing.
 *
 * @param vars - The workflow variables
 * @param objectIds - Optional array of object IDs (defaults to single test ID)
 * @returns A complete WorkflowExecutionPayload for use in tests
 */
export const getMockWorkflowPayload = <T extends ExampleWorkflowParams>(
    vars: T,
    objectIds: string[] = ['test-object-id']
): WorkflowExecutionPayload<T> => {
    return {
        event: ContentEventName.workflow_execution_request,
        objectIds,
        auth_token: 'mock-auth-token',
        account_id: 'mock-account-id',
        project_id: 'mock-project-id',
        config: {
            studio_url: 'http://mock-studio',
            store_url: 'http://mock-store',
        },
        vars: vars,
    };
};
