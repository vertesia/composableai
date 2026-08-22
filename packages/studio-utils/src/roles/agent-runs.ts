import type { AbacScope, RoleDomain } from '@vertesia/common';
import { AbacRole, type Role, type RolePartition } from './classes.js';

const AgentRunRoleDomain: RoleDomain = 'agent_runs';

const APPLICABLE_SCOPES: readonly AbacScope[] = ['agent_run'];

/** Names of roles that grant conditional access to agent and process runs. */
export enum AgentRunRoleNames {
    agent_run_reader = 'agent_runs:reader',
    agent_run_operator = 'agent_runs:operator',
}

class AgentRunReaderRole extends AbacRole {
    constructor() {
        super(AgentRunRoleNames.agent_run_reader, ['read'], AgentRunRoleDomain, APPLICABLE_SCOPES);
    }
}

class AgentRunOperatorRole extends AbacRole {
    constructor() {
        super(AgentRunRoleNames.agent_run_operator, ['read', 'control'], AgentRunRoleDomain, APPLICABLE_SCOPES);
    }
}

const agentRunRoles: Record<AgentRunRoleNames, Role> = {
    [AgentRunRoleNames.agent_run_reader]: new AgentRunReaderRole(),
    [AgentRunRoleNames.agent_run_operator]: new AgentRunOperatorRole(),
};

export const agentRunPartition: RolePartition = {
    domain: AgentRunRoleDomain,
    roles: new Map(Object.entries(agentRunRoles)),
};
