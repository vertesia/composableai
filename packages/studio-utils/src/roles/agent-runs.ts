import { type AbacScope, Permission, type RoleDomain } from '@vertesia/common';
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
        // Delegating run reads requires the RBAC the run read endpoints check (`workflow:read`), not
        // `agent_run:read`, which is the auditor-only "see every private run" capability.
        super(AgentRunRoleNames.agent_run_reader, ['read'], AgentRunRoleDomain, APPLICABLE_SCOPES, [
            Permission.workflow_read,
        ]);
    }
}

class AgentRunOperatorRole extends AbacRole {
    constructor() {
        super(AgentRunRoleNames.agent_run_operator, ['read', 'control'], AgentRunRoleDomain, APPLICABLE_SCOPES, [
            Permission.workflow_read,
            Permission.workflow_run,
        ]);
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
