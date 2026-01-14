export interface CreateWorkerDeploymentRequest {
    /**
     * The worker ID is composed from the worker organization and the worker name, separated by a slash.
     * Example: vertesia/docgen-worker
     */
    workerId: string;
    /**
     * The environment to deploy the worker to. This should be one of the following values:
     *   - `production`
     *   - `preview`
     *   - `staging`
     */
    environment: 'production' | 'preview' | 'staging';

    /**
     * The worker docker image version. A major.minor.patch[-modifier] string.
     */
    version: string;
}
