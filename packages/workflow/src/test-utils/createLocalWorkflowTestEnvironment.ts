import { TestWorkflowEnvironment } from '@temporalio/testing';

/** Tests can select a real installed CLI without constructing an SDK download cache entry. */
export function createLocalWorkflowTestEnvironment(): Promise<TestWorkflowEnvironment> {
    const path = process.env.VERTESIA_TEMPORAL_TEST_SERVER_BINARY;
    if (path) {
        return TestWorkflowEnvironment.createLocal({
            server: { executable: { type: 'existing-path', path } },
        });
    }
    return TestWorkflowEnvironment.createLocal();
}
