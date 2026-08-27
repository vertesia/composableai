import { ApiTopic, type ClientBase, type ServerError } from '@vertesia/api-fetch-client';
import type {
    AgentRunResponse,
    AppApiKeyCollectionParams,
    AppBuildProgress,
    AppDeleteSummary,
    AppDevelopmentTaskDetails,
    AppDevelopmentTaskList,
    AppInspectionResult,
    AppInstallation,
    AppInstallationKind,
    AppInstallationListEntry,
    AppInstallationPayload,
    AppInstallationWithManifest,
    AppManifest,
    AppManifestData,
    AppPackage,
    AppPackageScope,
    AppRepoBranch,
    AppRepoCommits,
    AppRepoDocumentCommit,
    AppRepoRefs,
    AppRepoTree,
    AppScaffoldProgress,
    AppsQuery,
    AppToolCollection,
    AppVersionListQuery,
    AppVersionRecord,
    CountResult,
    CreateAppRepoBranchRequest,
    DeleteAppVersionResponse,
    McpApiKeyStatus,
    ProjectRef,
    PromoteAppVersionResponse,
    RequireAtLeastOne,
    SetMcpApiKeyRequest,
    StartAppBuildRequest,
    StartAppBuildResponse,
    StartAppDevelopmentTaskRequest,
    StartAppScaffoldRequest,
    StartAppScaffoldResponse,
    UpdateAppInstallationToolAllowlistPayload,
    UpdateAppPayload,
    UpsertAppVersionRequest,
    ValidateUrlRequest,
    ValidateUrlResponse,
} from '@vertesia/common';

export type { OrphanedAppInstallation } from '@vertesia/common';

export default class AppsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/apps');
    }

    create(manifest: AppManifestData): Promise<AppManifest> {
        return this.post('/', { payload: manifest });
    }

    update(id: string, manifest: UpdateAppPayload): Promise<AppManifest> {
        return this.put(`/${id}`, { payload: manifest });
    }

    /**
     * Preview what the cascade delete would remove. Calls DELETE without confirm,
     * which the server treats as a dry-run and returns counts + paths.
     */
    previewDelete(id: string): Promise<AppDeleteSummary> {
        return this.del(`/${id}`);
    }

    /**
     * Store the API key of an MCP tool collection declared with `auth: 'api_key'`.
     * The key is write-only: it is encrypted server-side and never returned by any endpoint,
     * so the response carries only the configured flag and a masked hint.
     */
    setMcpCollectionApiKey(appId: string, collectionId: string, apiKey: string): Promise<McpApiKeyStatus> {
        return this.put(`/${encodeURIComponent(appId)}/collections/${encodeURIComponent(collectionId)}/api-key`, {
            payload: { api_key: apiKey } satisfies SetMcpApiKeyRequest,
        });
    }

    /** Whether an MCP tool collection has an API key stored, with a masked hint for display. */
    getMcpCollectionApiKeyStatus(appId: string, collectionId: string): Promise<McpApiKeyStatus> {
        return this.get(`/${encodeURIComponent(appId)}/collections/${encodeURIComponent(collectionId)}/api-key`);
    }

    /** Remove the stored API key of an MCP tool collection. */
    deleteMcpCollectionApiKey(appId: string, collectionId: string): Promise<McpApiKeyStatus> {
        return this.del(`/${encodeURIComponent(appId)}/collections/${encodeURIComponent(collectionId)}/api-key`);
    }

    /**
     * Cascade-delete an app and everything attached to it (versions,
     * installations + ACEs, git repo on the app-git server). Pass through
     * the dry-run summary; confirm flag is required server-side.
     */
    deleteApp(id: string): Promise<AppDeleteSummary> {
        return this.del(`/${id}`, { query: { confirm: 'true' } });
    }

    listVersions(query?: AppVersionListQuery): Promise<AppVersionRecord[]> {
        return this.get('/versions', {
            query: {
                ...(query?.app_id && { app_id: query.app_id }),
                ...(query?.kind && { kind: query.kind }),
                ...(query?.include_expired !== undefined && { include_expired: query.include_expired }),
                ...(query?.limit !== undefined && { limit: query.limit }),
            },
        });
    }

    upsertVersion(payload: UpsertAppVersionRequest): Promise<AppVersionRecord> {
        return this.post('/versions', { payload });
    }

    getVersion(recordId: string): Promise<AppVersionRecord> {
        return this.get(`/versions/${recordId}`);
    }

    promoteVersion(recordId: string): Promise<PromoteAppVersionResponse> {
        return this.post(`/versions/${recordId}/promote`);
    }

    rebuildVersion(recordId: string): Promise<StartAppBuildResponse> {
        return this.post(`/versions/${recordId}/rebuild`);
    }

    deleteVersion(recordId: string): Promise<DeleteAppVersionResponse> {
        return this.del(`/versions/${recordId}`);
    }

    startBuild(appIdOrRecordId: string, payload: StartAppBuildRequest): Promise<StartAppBuildResponse> {
        return this.post(`/${encodeURIComponent(appIdOrRecordId)}/builds`, { payload });
    }

    getBuildProgress(appIdOrRecordId: string, workflowId: string, runId: string): Promise<AppBuildProgress> {
        return this.get(
            `/${encodeURIComponent(appIdOrRecordId)}/builds/${encodeURIComponent(workflowId)}/${encodeURIComponent(runId)}/progress`,
        );
    }

    startScaffold(payload: StartAppScaffoldRequest): Promise<StartAppScaffoldResponse> {
        return this.post('/scaffolds', { payload });
    }

    getScaffoldProgress(workflowId: string, runId: string): Promise<AppScaffoldProgress> {
        return this.get(`/scaffolds/${encodeURIComponent(workflowId)}/${encodeURIComponent(runId)}/progress`);
    }

    /**
     * Get the list if tools provided by the given app.
     * @param appId
     * @returns
     */
    listAppInstallationTools(appInstallId: string): Promise<AppToolCollection[]> {
        return this.get(`/installations/${appInstallId}/tools`);
    }

    /**
     * Inspect an app's registration: resolved manifest state, what the published
     * package actually exposes per capability, endpoint reachability, install
     * state, and diagnostics. Use this to verify what an app registers vs what it
     * declares, instead of inferring it from failed object/import calls.
     */
    inspect(appIdOrName: string): Promise<AppInspectionResult> {
        return this.get(`/${appIdOrName}/inspect`);
    }

    /**
     * List files/directories under a prefix in the app's git repository (default
     * branch unless `ref` is given). Read-only; reads live from the git server
     * without a clone. Used by the Build > Design view to surface generated `docs/`.
     */
    getRepoTree(appIdOrName: string, options?: { prefix?: string; ref?: string }): Promise<AppRepoTree> {
        return this.get(`/${encodeURIComponent(appIdOrName)}/repo/tree`, {
            query: { prefix: options?.prefix, ref: options?.ref },
        });
    }

    /**
     * Read the original bytes of a single file in the app's git repository (default
     * branch unless `ref` is given). The caller decides whether to consume the
     * successful response as text, a Blob, or an ArrayBuffer.
     */
    async getRepoFile(appIdOrName: string, path: string, options?: { ref?: string }): Promise<Response> {
        const endpoint = `/${encodeURIComponent(appIdOrName)}/repo/file`;
        const response = await this.get<Response>(endpoint, {
            query: { path, ref: options?.ref },
            reader: (rawResponse) => rawResponse,
        });
        if (!response.ok) {
            const payload = await this.readJSONPayload(response);
            const request = await this.createRequest(response.url || this.getUrl(endpoint), { method: 'GET' });
            throw this.createServerError(request, response, payload);
        }
        return response;
    }

    /**
     * Commit one or more files under the repository's allowed document roots.
     * The Git service currently permits only `docs/`. All files are written in
     * one commit and `expectedHead` prevents overwriting a concurrent push.
     */
    commitRepoDocuments(
        appIdOrName: string,
        files: Array<{ path: string; content: Blob; fileName?: string }>,
        options: { ref: string; expectedHead: string; message?: string },
    ): Promise<AppRepoDocumentCommit> {
        const form = new FormData();
        const metadata = {
            ref: options.ref,
            expected_head: options.expectedHead,
            message: options.message || 'Upload documentation',
            files: files.map((file, index) => ({ field: `file_${index}`, path: file.path })),
        };
        form.append('metadata', JSON.stringify(metadata));
        files.forEach((file, index) => {
            form.append(`file_${index}`, file.content, file.fileName || file.path.split('/').pop() || 'document');
        });
        return this.post(`/${encodeURIComponent(appIdOrName)}/repo/documents`, {
            payload: form,
            jsonPayload: false,
            timeoutMs: 120_000,
        });
    }

    /**
     * List repository commits newest first, optionally filtered to commits that changed a file.
     * History starts at the default branch unless a branch, tag, or commit SHA is supplied as `ref`.
     */
    getRepoCommits(
        appIdOrName: string,
        path?: string,
        options?: { ref?: string; limit?: number; cursor?: string },
    ): Promise<AppRepoCommits> {
        return this.get(`/${encodeURIComponent(appIdOrName)}/repo/commits`, {
            query: { path, ref: options?.ref, limit: options?.limit, cursor: options?.cursor },
        });
    }

    /**
     * List the branches and tags of the app's git repository, each resolved to its latest commit.
     * Read-only; reads live from the git server without a clone. Used by the Source view to let a
     * user pick a ref to build from.
     */
    getRepoRefs(appIdOrName: string): Promise<AppRepoRefs> {
        return this.get(`/${encodeURIComponent(appIdOrName)}/repo/refs`);
    }

    /** List mutable development tasks represented by `agent/*` repository branches. */
    listDevelopmentTasks(appIdOrName: string): Promise<AppDevelopmentTaskList> {
        return this.get(`/${encodeURIComponent(appIdOrName)}/development-tasks`);
    }

    /** Get a development task and its latest App Builder parent run, when started. */
    getDevelopmentTask(appIdOrName: string, taskId: string): Promise<AppDevelopmentTaskDetails> {
        return this.get(`/${encodeURIComponent(appIdOrName)}/development-tasks/${encodeURIComponent(taskId)}`);
    }

    /** Start the policy-controlled App Builder parent on an existing development-task branch. */
    startDevelopmentTask(
        appIdOrName: string,
        taskId: string,
        payload: StartAppDevelopmentTaskRequest,
    ): Promise<AgentRunResponse> {
        return this.post(`/${encodeURIComponent(appIdOrName)}/development-tasks/${encodeURIComponent(taskId)}/runs`, {
            payload,
        });
    }

    /** Create a repository branch from an existing branch, tag, or commit. */
    createRepoBranch(appIdOrName: string, payload: CreateAppRepoBranchRequest): Promise<AppRepoBranch> {
        return this.post(`/${encodeURIComponent(appIdOrName)}/repo/branches`, { payload });
    }

    /**
     * Get the promoted package an app exposes, filtered by scope. App-owned (in-code) artifacts are
     * package-resolved (no per-id route), so this is how a client reads the full definition — type
     * schema, interaction prompt, process definition, dashboard spec — to visualize an exposed id.
     */
    getAppPackage(appIdOrName: string, scope: AppPackageScope | AppPackageScope[] = 'all'): Promise<AppPackage> {
        return this.get(`/${encodeURIComponent(appIdOrName)}/package`, {
            query: { scope: Array.isArray(scope) ? scope.join(',') : scope },
        });
    }

    /**
     * Get package capabilities exposed by an app installation.
     */
    getAppInstallationPackage(
        appInstallId: string,
        scope: AppPackageScope | AppPackageScope[] = 'all',
    ): Promise<AppPackage> {
        return this.get(`/installations/${appInstallId}/package`, {
            query: {
                scope: Array.isArray(scope) ? scope.join(',') : scope,
            },
        });
    }

    /**
     * Fetch the always-on system tools package served by studio-server.
     * Tools and skills (`learn_*`) are returned on separate fields so UIs can
     * render them distinctly. URLs are already resolved per deployment.
     */
    getSystemToolsPackage(scope: string = 'tools'): Promise<AppPackage> {
        return this.get('/studio-tools/package', { query: { scope } });
    }

    /**
     * @param query - pass `{ scope: 'project' }` to list only the apps installed in, or built in,
     * the current project. Defaults to every app visible to the account, including the public catalog.
     * @returns the app manifests but without the agent.tool property which can be big.
     */
    list(query?: AppsQuery): Promise<AppManifest[]> {
        return this.get('/', { query: { ...(query?.scope && { scope: query.scope }) } });
    }

    /**
     * Install the app with the given id in the current project.
     * @param appId - the id of the app to install
     */
    install(
        appId: string,
        settings?: Record<string, unknown>,
        oauthParams?: Record<string, { client_id?: string; client_secret?: string; scopes?: string[] }>,
        oauthProviderParams?: Record<string, { client_id?: string; client_secret?: string; scopes?: string[] }>,
        apiKeyParams?: AppApiKeyCollectionParams,
    ): Promise<AppInstallation> {
        return this.post(`/install`, {
            payload: {
                app_id: appId,
                settings,
                oauth_params: oauthParams,
                oauth_provider_params: oauthProviderParams,
                api_key_params: apiKeyParams,
            } satisfies AppInstallationPayload,
        });
    }

    /**
     * Remove the given app from the current project.
     * @param installationId - the id of the app installation
     * @returns
     */
    uninstall(installationId: string): Promise<CountResult> {
        return this.del(`/install/${installationId}`);
    }

    /**
     * get an app unstallation given its name or null if the app is not installed
     * @returns
     */
    getAppInstallationByName(appName: string): Promise<AppInstallationWithManifest | null> {
        return this.get<AppInstallationWithManifest>(`/installations/name/${appName}`).catch((err: ServerError) => {
            if (err.status === 404) {
                return null;
            } else {
                throw err;
            }
        });
    }

    /**
     * Get the project refs where the application is visible by the current user.
     * The application is specified either by id or by name.
     * @param param0
     * @returns
     */
    getAppInstallationProjects(
        app: RequireAtLeastOne<{ id?: string; name?: string }, 'id' | 'name'>,
    ): Promise<ProjectRef[]> {
        if (!app.id && !app.name) {
            throw new Error('Invalid arguments: appId or appName must be specified');
        }
        const query = app.id
            ? {
                  id: app.id,
              }
            : {
                  name: app.name,
              };
        return this.get('/installations/projects', {
            query,
        });
    }

    /**
     * Get the apps installed for the current authenticated project
     * @param kind - the kind of app installations to filter by (e.g., 'agent', 'tool', etc.)
     */
    getInstalledApps(kind?: AppInstallationKind): Promise<AppInstallationWithManifest[]> {
        return this.get('/installations', {
            query: {
                kind,
            },
        });
    }

    /**
     * This operation will return an array of all the found AppInstallations in the current project
     * including orphaned installations
     * This requires project admin since access is not checked on the insytallations.
     * For a user level list of available installations (with user permission check) use getInstalledApps
     * @returns
     */
    getAllAppInstallations(): Promise<AppInstallationListEntry[]> {
        return this.get('/installations/all');
    }

    /**
     * List the app installations of the current project.
     */
    listInstallations(): Promise<AppInstallation[]> {
        return this.get('/installations/refs');
    }

    updateInstallationSettings(settingsPayload: AppInstallationPayload): Promise<AppInstallationWithManifest> {
        return this.put(`/installations/settings/${settingsPayload.app_id}`, {
            payload: {
                app_id: settingsPayload.app_id,
                settings: settingsPayload.settings,
                // Forward access_control when the caller provided it (including explicit null to
                // clear an override). The server uses `'access_control' in payload` to distinguish
                // "leave unchanged" from "clear", so only spread the key when it was supplied.
                ...('access_control' in settingsPayload ? { access_control: settingsPayload.access_control } : {}),
            } satisfies AppInstallationPayload,
        });
    }

    /**
     * Update the tool allowlist for an app installation.
     * Pass null to remove all restrictions (all tools permitted).
     */
    updateToolAllowlist(installId: string, tool_allowlist: string[] | null): Promise<AppInstallationWithManifest> {
        return this.put(`/installations/${installId}/tool-allowlist`, {
            payload: { tool_allowlist } satisfies UpdateAppInstallationToolAllowlistPayload,
        });
    }

    /**
     * Validate that a URL is safe to use as a remote tool/activity endpoint.
     * Throws a ServerError(400) if the URL is blocked (SSRF protection).
     */
    validateUrl(url: string): Promise<ValidateUrlResponse> {
        return this.post('/validate-url', { payload: { url } satisfies ValidateUrlRequest });
    }
}
