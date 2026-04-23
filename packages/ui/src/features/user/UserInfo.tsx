import { ApiKey, PrincipalType, User, UserGroup } from "@vertesia/common";
import { Avatar, Popover, PopoverContent, PopoverTrigger, Table, useFetch } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { Users, Users2 } from "lucide-react";
import { ReactNode } from "react";
import { useUITranslation } from '../../i18n/index.js';

const USER_CACHE: Record<string, Promise<User>> = {};
const GROUP_CACHE: Record<string, Promise<UserGroup>> = {};
const APIKEY_CACHE: Record<string, Promise<ApiKey>> = {};

function cachedFetch<T>(cache: Record<string, Promise<T>>, key: string, fetcher: () => Promise<T>): Promise<T> {
    let entry = cache[key];
    if (!entry) {
        entry = fetcher().catch((err) => {
            delete cache[key]; // evict on failure so retries work
            throw err;
        });
        cache[key] = entry;
    }
    return entry;
}

/**
 * Fetch the user information given a user reference.
 * The reference has the format: `type:id`. A special reference `system` is used to refer to the system user.
 * @param userRef
 */
export function useFetchUserInfo(userId: string) {
    const { client } = useUserSession();

    return useFetch(() => cachedFetch(USER_CACHE, userId, () => client.users.retrieve(userId)), [userId]);
}

/**
 * Fetch the group information given a group ID.
 * @param groupId
 */
export function useFetchGroupInfo(groupId: string) {
    const { client } = useUserSession();

    return useFetch(() => cachedFetch(GROUP_CACHE, groupId, () => client.iam.groups.retrieve(groupId)), [groupId]);
}

/**
 * Fetch the API key information given a key ID.
 * @param keyId
 */
export function useFetchApiKeyInfo(keyId: string) {
    const { client } = useUserSession();

    return useFetch(() => cachedFetch(APIKEY_CACHE, keyId, () => client.apikeys.retrieve(keyId)), [keyId]);
}

function AvatarPlaceholder() {
    return <div className='size-8' />
}

interface InfoProps {
    showTitle?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

function SystemAvatar({ showTitle = false, size = "md" }: InfoProps) {
    const { t } = useUITranslation();
    return (
        <UserPopoverPanel title={t('user.systemUser')} description={t('user.systemUserDescription')}>
            <div className="flex gap-2 items-center">
                <Avatar src="/icon.svg" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2">{t('user.systemUser')}</div>}
            </div>
        </UserPopoverPanel>
    )
}

function ProjectMembersAvatar({ showTitle = false, size = "md" }: InfoProps) {
    const { t } = useUITranslation();
    return (
        <UserPopoverPanel title={t('user.allProjectMembers')} description={t('user.allProjectMembersDescription')}>
            <div className="flex gap-2 items-center">
                <Users2 className="size-4" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2">{t('user.allProjectMembers')}</div>}
            </div>
        </UserPopoverPanel>
    )
}
interface ServiceInfoProps extends InfoProps {
    accountId: string;
}
function ServiceAccountAvatar({ accountId, showTitle = false, size = "md" }: ServiceInfoProps) {
    const { t } = useUITranslation();
    const _type = accountId.split(':')[0];
    const _accountId = accountId.split(':')[1];
    const description = (
        <>
            <div>{t('user.serviceAccountDescription')}</div>
            <div className="text-muted text-sm"><span className="font-semibold">Type:</span> {_type}</div>
            <div className="text-muted text-sm"><span className="font-semibold">ID:</span> {_accountId}</div>
        </>
    )

    return (
        <UserPopoverPanel title={t('user.serviceAccount')} description={description}>
            <div className="flex flex-row items-center gap-2">
                <Avatar src="/cloud.svg" name="SA" color="bg-amber-500" className="px-[5px] text-white" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2 truncate">{t('user.serviceAccount')} : ~{_accountId.slice(-6)}</div>}
            </div>
        </UserPopoverPanel>
    );
}


interface EmailAgentAvatarProps extends InfoProps {
    email: string;
}
function EmailAgentAvatar({ email, showTitle = false, size = "md" }: EmailAgentAvatarProps) {
    const { t } = useUITranslation();

    const description = (
        <>
            <div>{t('user.serviceAccountDescription')}</div>
            <div className="text-muted text-sm"><span className="font-semibold">Email:</span> {email}</div>
        </>
    )
    return (
        <UserPopoverPanel title={'Email Agent'} description={description}>
            <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-2">
                    <Avatar
                        src="/cloud.svg"
                        color="bg-amber-500"
                        className="px-[5px] text-white border-2 border-white dark:border-gray-800"
                        size={size}
                    />
                    <Avatar
                        name={email}
                        size={size}
                        className="border-2 border-white dark:border-gray-800"
                    />
                </div>
                {showTitle && (
                    <div className="text-sm font-semibold truncate">
                        {t('user.agentOnBehalfOf')} : {email}
                    </div>
                )}
            </div>
        </UserPopoverPanel>
    );
}

interface AgentAvatarProps extends InfoProps {
    agentId: string;  // Format: accountId:projectId:timestamp
    onBehalfOfType?: string;
    onBehalfOfId?: string;
    isScheduleAgent?: boolean;
}
function AgentAvatar({ agentId, onBehalfOfType, onBehalfOfId, showTitle = false, size = "md", isScheduleAgent = false }: AgentAvatarProps) {
    const { t } = useUITranslation();
    // Fetch user info - must call hooks unconditionally per React rules
    const shouldFetchUser = onBehalfOfType === 'user' && onBehalfOfId;
    const shouldFetchApiKey = onBehalfOfType === 'apikey' && onBehalfOfId;

    const userResult = useFetchUserInfo(onBehalfOfId || '');
    const apiKeyResult = useFetchApiKeyInfo(onBehalfOfId || '');

    // Only use the data if we should fetch it
    const user = shouldFetchUser ? userResult.data : undefined;
    const apiKey = shouldFetchApiKey ? apiKeyResult.data : undefined;

    // Determine title and description
    const shortenedAgentId = agentId.slice(-6);
    const title = user ? t('user.agentOnBehalfOf') : apiKey ? t('user.agentOnBehalfOfApiKey') : t('user.serviceAccount') + `~${shortenedAgentId}`;
    const _title = isScheduleAgent ? t('user.schedule', { title }) : title;

    const description = (
        <div className="space-y-2">
            {user && (
                <>
                    <div className="flex items-center gap-2">
                        <Avatar src={user.picture} name={user.name} size="sm" />
                        <div>
                            <div className="font-medium">{user.name || user.email}</div>
                            {user.email && user.name && <div className="text-xs text-muted">{user.email}</div>}
                        </div>
                    </div>
                </>
            )}
            {apiKey && (
                <>
                    <div>
                        <div className="font-medium">{apiKey.name}</div>
                        <div className="text-xs text-muted-foreground">Key ID: {apiKey.id}</div>
                    </div>
                </>
            )}
            {!user && !apiKey && (
                <>
                    <div>{t('user.serviceAccountDescription')}</div>
                    <div className="text-gray-800 dark:text-gray-500 text-sm">
                        <span className="font-semibold">ID:</span> {agentId}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <UserPopoverPanel title={_title} description={description}>
            <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-2">
                    <Avatar
                        src="/cloud.svg"
                        color="bg-amber-500"
                        className="px-[5px] text-white border-2 border-white dark:border-gray-800"
                        size={size}
                    />
                    {user && (
                        <Avatar
                            src={user.picture}
                            name={user.name}
                            size={size}
                            className="border-2 border-white dark:border-gray-800"
                        />
                    )}
                    {apiKey && (
                        <Avatar
                            name="API"
                            color="bg-gray-400"
                            size={size}
                            className="border-2 border-white dark:border-gray-800"
                        />
                    )}
                </div>
                {showTitle && (
                    <div className="text-sm font-semibold truncate">
                        {user ? `Agent      (${user.name || user.email})` : apiKey ? `Agent (${apiKey.name})` : title}
                    </div>
                )}
            </div>
        </UserPopoverPanel>
    );
}

interface ErrorInfoProps extends InfoProps {
    title?: string;
    error: Error | string;
}
function ErrorAvatar({ title = "Error", error, showTitle = false, size = "md" }: ErrorInfoProps) {
    return (
        <UnknownAvatar title={title} message={typeof error === 'string' ? error : error.message} color="bg-red-500" showTitle={showTitle} size={size} />
    );
}

interface UserInfoProps extends InfoProps {
    /**
     * The user reference is a string that contains the type and id of the user.
     *
     * The format is: `type:id`, where "type" is the {@link PrincipalType} and the "id" is the
     * object ID in the database.
     *
     * @example user:123
     * @example service_account:123
     * @example apikey:123
     * @example project:* (all project members — synthetic principal used in ACLs)
     */
    userRef: string | undefined;
}
export function UserInfo({ userRef, showTitle = false, size = "md" }: UserInfoProps) {
    const { t } = useUITranslation();
    if (!userRef) {
        return <UnknownAvatar title={t('user.unknownUser')} message={t('user.unknownUserDescription')} showTitle={showTitle} size={size} />
    }

    const parts = userRef.split(':');
    const type = parts[0];

    switch (type) {
        case PrincipalType.User:
            return <UserAvatar userId={parts[1]} showTitle={showTitle} size={size} />

        case PrincipalType.Group:
            return <GroupAvatar userId={parts[1]} showTitle={showTitle} size={size} />

        case "system":
            return <SystemAvatar showTitle={showTitle} size={size} />

        case PrincipalType.ServiceAccount:
            return <ServiceAccountAvatar accountId={parts.slice(1).join(':')} showTitle={showTitle} size={size} />

        case PrincipalType.Agent: {
            // Parse agent format: agent:accountId:projectId:timestamp[:on_behalf_type:on_behalf_id]
            // Handle legacy formats:
            // - agent:agent:accountId:projectId:timestamp (old bug)
            // - agent:accountId:projectId:timestamp (fixed, no on_behalf_of)
            // - agent:accountId:projectId:timestamp:user:userId (new format)

            let agentId: string;
            let onBehalfOfType: string | undefined;
            let onBehalfOfId: string | undefined;

            // Check for old buggy format with double "agent"
            if (parts[1] === 'agent') {
                // Old format: agent:agent:accountId:projectId:timestamp
                agentId = parts.slice(2, 5).join(':');
                // Check if there's on_behalf_of info (unlikely but handle it)
                onBehalfOfType = parts[5];
                onBehalfOfId = parts[6];
            } else {
                // New format: agent:accountId:projectId:timestamp[:type:id]
                agentId = parts.slice(1, 4).join(':');
                onBehalfOfType = parts[4];
                onBehalfOfId = parts[5];
            }

            return <AgentAvatar
                agentId={agentId}
                onBehalfOfType={onBehalfOfType}
                onBehalfOfId={onBehalfOfId}
                showTitle={showTitle}
                size={size}
            />
        }

        case PrincipalType.Schedule: {
            // format: schedule:{scheduleID}:agent:{accountID}:{projectID}:{agentID}:user:{userId}

            const agentId = parts[2] === 'agent' ? parts.slice(3, 6).join(':') : 'unknown-agent';
            const onBehalfOfType = parts[6]; // e.g. "user"
            const onBehalfOfId = parts[7]; // e.g. userId

            return <AgentAvatar
                agentId={agentId}
                onBehalfOfType={onBehalfOfType}
                onBehalfOfId={onBehalfOfId}
                showTitle={showTitle}
                size={size}
                isScheduleAgent={true}
            />
        }

        case "email": {
            // format: email:userEmail
            return <EmailAgentAvatar email={parts[1]} showTitle={showTitle} size={size} />

        }


        case PrincipalType.ApiKey:
            return <ApiKeyAvatar keyId={parts[1]} size={size} showTitle={showTitle} />

        case "project":
            // Only the wildcard "project:*" is a valid synthetic principal (all project members).
            // Any other project:<...> shape falls through to the error default.
            if (parts[1] === "*") {
                return <ProjectMembersAvatar showTitle={showTitle} size={size} />
            }
            break;

        default:
            return <ErrorAvatar title={t('user.unknownUser')} error={`Invalid user ref type: ${type}`} showTitle={showTitle} size={size} />
    }
}

interface UnknownAvatarProps extends InfoProps {
    title: string;
    message: ReactNode;
    color?: string;
}
function UnknownAvatar({ title, message, color, size = "md", showTitle = false }: UnknownAvatarProps) {
    return (
        <UserPopoverPanel title={title} description={message}>
            <div className="flex flex-row items-center gap-2">
                <Avatar color={color} size={size} />
                {showTitle && <div className="text-sm font-semibold pl-1">{title}</div>}
            </div>
        </UserPopoverPanel>
    )
}

interface GroupAvatarProps extends InfoProps {
    userId: string;
}
function GroupAvatar({ userId, showTitle = false, size = "md" }: GroupAvatarProps) {
    const { t } = useUITranslation();
    const { data: group, error } = useFetchGroupInfo(userId);

    if (error) {
        return <ErrorAvatar title={t('user.failedToFetchGroup')} error={error} showTitle={showTitle} size={size} />
    }

    if (!group) {
        return <AvatarPlaceholder />
    }

    const description = (
        <div className="space-y-1">
            {group.description && <div className="text-sm">{group.description}</div>}
            <div className="text-xs text-muted-foreground">{t('user.groupId', { id: group.id })}</div>
            {group.tags && group.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {group.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs">{tag}</span>
                    ))}
                </div>
            )}
        </div>
    )

    return (
        <UserPopoverPanel title={group.name || t('user.unnamedGroup')} description={description}>
            <div className="flex flex-row items-center gap-2">
                <Users className="size-6 text-indigo-500" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2">{group.name || t('user.unnamedGroup')}</div>}
            </div>
        </UserPopoverPanel>
    )
}

interface UserAvatarProps extends InfoProps {
    userId: string;
}
function UserAvatar({ userId, showTitle = false, size = "md" }: UserAvatarProps) {
    const { t } = useUITranslation();
    const { data: user, error } = useFetchUserInfo(userId);

    if (error) {
        return <ErrorAvatar title={t('user.failedToFetchUser')} error={error} showTitle={showTitle} size={size} />
    }

    if (!user) {
        return <AvatarPlaceholder />
    }

    const description = (
        <div className="truncate" title={user.email}>{user.email}</div>
    )

    return (
        <UserPopoverPanel title={user.name || user.email || user.username || t('user.unknown')} description={description}>
            <div className="flex flex-row items-center gap-2">
                <Avatar src={user.picture} name={user.name} color="bg-indigo-500" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2">{user.name || user.email || user.username || t('user.unknown')}</div>}
            </div>
        </UserPopoverPanel>
    )
}

interface ApiKeyAvatarProps extends InfoProps {
    keyId: string;
}
export function ApiKeyAvatar({ keyId, showTitle = false, size = "md" }: ApiKeyAvatarProps) {
    const { t } = useUITranslation();
    const { data, error } = useFetchApiKeyInfo(keyId);

    if (error) {
        return <ErrorAvatar title={t('user.failedToFetchApiKey')} error={error} showTitle={showTitle} size={size} />
    }

    if (!data) {
        return <AvatarPlaceholder />
    }

    const title = t('user.privateKey');
    const avatar = <Avatar name={"PK"} color="bg-pink-500" size={size} />;
    const description = (
        <Table className="dark:bg-gray-800 dark:text-gray-200 table-fixed w-full">
            <tr>
                <td className="font-semibold w-20">{t('user.key')}</td>
                <td className="truncate max-w-0">{data?.name}</td>
            </tr>
            <tr>
                <td className="font-semibold w-20">{t('user.account')}</td>
                <td className="truncate max-w-0">{data?.account}</td>
            </tr>
            <tr>
                <td className="font-semibold w-20">{t('user.project')}</td>
                <td className="truncate max-w-0">{data?.project.name}</td>
            </tr>
        </Table>
    );

    return (
        <UserPopoverPanel title={title} description={description}>
            <div className="flex flex-row items-center gap-2">
                {avatar}
                {showTitle && <div className="text-sm font-semibold">{data?.name || data?.account || data?.project.name || t('user.unknown')}</div>}
            </div>
        </UserPopoverPanel >
    )
}

interface UserPopoverPanelProps {
    title: string;
    description: ReactNode;
    children: React.ReactNode;
}
function UserPopoverPanel({ title, description, children }: UserPopoverPanelProps) {
    return (
        <Popover hover>
            <PopoverTrigger className="cursor-pointer flex items-center inline-block">
                <div>{children}</div>
            </PopoverTrigger>
            <PopoverContent align="center" sideOffset={8} side="right">
                <div className="flex flex-col gap-1 rounded-md shadow-md p-2">
                    <div className='text-md font-semibold'>{title}</div>
                    {description}
                </div>
            </PopoverContent>
        </Popover>
    )
}
