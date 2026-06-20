import {
    type AppInstallationWithManifest,
    type MCPToolCollectionObject,
    normalizeToolCollection,
    type OAuthAuthStatus,
} from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A group of MCP tool collections that share a single OAuth connection.
 * Connection/activation operations act on the whole group.
 */
export interface McpConnectionGroup {
    key: string;
    appId: string;
    appName: string;
    /** Display label: provider display_name, oauth_app name, or individual collection name */
    label: string;
    /** Representative collection ID used for OAuth operations (all in group share the same OAuth provider) */
    representativeId: string;
    /** All collection IDs in this group (used for per-conversation activation toggles) */
    memberIds: string[];
    /** Names of all collections in this group (for tooltip when > 1) */
    memberNames: string[];
    authStatus?: OAuthAuthStatus;
}

/**
 * Loads the project's installed MCP tool collections that require OAuth, grouped by their
 * shared OAuth provider/app, and resolves each group's current connection status.
 *
 * Shared by the MCP connections button (badge count) and dialog (list) so the data is
 * fetched once and refreshed together after connect/disconnect.
 */
export function useMcpConnections() {
    const { client } = useUserSession();
    const [groups, setGroups] = useState<McpConnectionGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusLoading, setStatusLoading] = useState(false);
    const reloadIdRef = useRef(0);

    const reload = useCallback(async () => {
        const reloadId = reloadIdRef.current + 1;
        reloadIdRef.current = reloadId;
        setLoading(true);
        setStatusLoading(false);
        try {
            const apps = await client.apps.getInstalledApps('tools');
            const allGroups: McpConnectionGroup[] = [];

            for (const app of apps) {
                const inst = app as AppInstallationWithManifest;
                const oauthIds = inst.oauth_collection_ids ?? [];
                const manifestProviders = inst.manifest.oauth_providers ?? {};

                if (!inst.manifest.tool_collections) continue;

                const oauthCollections = inst.manifest.tool_collections
                    .map((c) => normalizeToolCollection(c))
                    .filter((c): c is MCPToolCollectionObject => c.type === 'mcp' && oauthIds.includes(c.id));

                const providerMap = new Map<string, MCPToolCollectionObject[]>();
                const oauthAppMap = new Map<string, MCPToolCollectionObject[]>();
                const individualCols: MCPToolCollectionObject[] = [];

                for (const col of oauthCollections) {
                    if (col.oauth_provider) {
                        const g = providerMap.get(col.oauth_provider) ?? [];
                        g.push(col);
                        providerMap.set(col.oauth_provider, g);
                    } else if (col.oauth_app) {
                        const g = oauthAppMap.get(col.oauth_app) ?? [];
                        g.push(col);
                        oauthAppMap.set(col.oauth_app, g);
                    } else {
                        individualCols.push(col);
                    }
                }

                for (const [providerKey, cols] of providerMap) {
                    allGroups.push({
                        key: `${inst.id}:provider:${providerKey}`,
                        appId: inst.id,
                        appName: inst.manifest.title || inst.manifest.name,
                        label: manifestProviders[providerKey]?.display_name || providerKey,
                        representativeId: cols[0].id,
                        memberIds: cols.map((c) => c.id),
                        memberNames: cols.map((c) => c.name),
                    });
                }

                for (const [oauthApp, cols] of oauthAppMap) {
                    allGroups.push({
                        key: `${inst.id}:oauthapp:${oauthApp}`,
                        appId: inst.id,
                        appName: inst.manifest.title || inst.manifest.name,
                        label: oauthApp,
                        representativeId: cols[0].id,
                        memberIds: cols.map((c) => c.id),
                        memberNames: cols.map((c) => c.name),
                    });
                }

                for (const col of individualCols) {
                    allGroups.push({
                        key: `${inst.id}:individual:${col.id}`,
                        appId: inst.id,
                        appName: inst.manifest.title || inst.manifest.name,
                        label: col.name,
                        representativeId: col.id,
                        memberIds: [col.id],
                        memberNames: [col.name],
                    });
                }
            }

            if (reloadIdRef.current !== reloadId) {
                return;
            }

            setGroups(allGroups);
            setLoading(false);

            if (allGroups.length === 0) {
                return;
            }

            setStatusLoading(true);

            // Fetch OAuth status once per app installation; getStatus(appId) returns all collection statuses.
            const statusRequestsByApp = new Map<string, Promise<OAuthAuthStatus[]>>();
            const groupsWithStatus = await Promise.all(
                allGroups.map(async (group) => {
                    try {
                        let statusRequest = statusRequestsByApp.get(group.appId);
                        if (!statusRequest) {
                            statusRequest = client.remoteMcpConnections.getStatus(group.appId);
                            statusRequestsByApp.set(group.appId, statusRequest);
                        }
                        const statuses = await statusRequest;
                        const status = statuses.find((s) => s.collection_id === group.representativeId);
                        return { ...group, authStatus: status };
                    } catch {
                        return group;
                    }
                }),
            );

            if (reloadIdRef.current !== reloadId) {
                return;
            }

            setGroups(groupsWithStatus);
        } catch (error) {
            if (reloadIdRef.current === reloadId) {
                console.error('Failed to load MCP tool collections:', error);
                setGroups([]);
            }
        } finally {
            if (reloadIdRef.current === reloadId) {
                setLoading(false);
                setStatusLoading(false);
            }
        }
    }, [client]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { groups, loading, statusLoading, reload };
}

/** True when every collection in the group is present in the disabled set. */
export function isGroupDisabled(group: McpConnectionGroup, disabled?: string[]): boolean {
    if (!disabled?.length) return false;
    return group.memberIds.every((id) => disabled.includes(id));
}

/**
 * Toggle a group's activation, returning the next disabled-collection list.
 * Disabling adds all member ids; enabling removes them.
 */
export function toggleGroupDisabled(
    group: McpConnectionGroup,
    disabled: string[] | undefined,
    active: boolean,
): string[] {
    const current = new Set(disabled ?? []);
    if (active) {
        for (const id of group.memberIds) current.delete(id);
    } else {
        for (const id of group.memberIds) current.add(id);
    }
    return Array.from(current);
}

/** Count connected MCP groups that are enabled for the current conversation. */
export function countConnectedActiveGroups(groups: McpConnectionGroup[], disabled?: string[]): number {
    return groups.filter((group) => group.authStatus?.authenticated === true && !isGroupDisabled(group, disabled))
        .length;
}

/** Names of connected MCP groups that are enabled for the current conversation. */
export function getConnectedActiveGroupLabels(groups: McpConnectionGroup[], disabled?: string[]): string[] {
    return groups
        .filter((group) => group.authStatus?.authenticated === true && !isGroupDisabled(group, disabled))
        .map((group) => group.label);
}
