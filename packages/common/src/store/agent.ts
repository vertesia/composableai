export interface CreateAgentDeploymentRequest {
    /**
     * The agent ID is composed from the agent organization and the agent name, separated by a slash.
     * Example: vertesia/docgen-agent
     */
    agentId: string;
    /**
     * The environment to deploy the agent to. This should be one of the following values:
     *   - `production`
     *   - `preview`
     *   - `staging`
     */
    environment: 'production' | 'preview' | 'staging';

    /**
     * The agent docker image version. A major.minor.patch[-modifier] string.
     */
    version: string;
}
