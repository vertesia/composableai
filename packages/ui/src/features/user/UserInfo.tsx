import { useUserSession } from "@vertesia/ui/session";
import { ApiKey, ApiKeyTypes, PrincipalType, User } from "@vertesia/common";
import { Avatar, Table, Popover, PopoverContent, PopoverTrigger, useFetch } from "@vertesia/ui/core";
import { ReactNode } from "react";

//TODO use a real cache
const USER_CACHE: Record<string, Promise<User>> = {};

/**
 * Fetch the user information given a user reference.
 * The reference has the format: `type:id`. A special reference `system` is used to refer to the system user.
 * @param userRef
 */
export function useFetchUserInfo(userId: string) {
    const { client } = useUserSession();

    return useFetch(() => {
        let user: Promise<User> | undefined = USER_CACHE[userId];
        if (!user) {
            user = client.users.retrieve(userId).then(user => {
                return user;
            });
            USER_CACHE[userId] = user;
        }
        return user;
    }, [userId]);
}

function AvatarPlaceholder() {
    return <div className='size-8' />
}

interface InfoProps {
    showTitle?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

function SystemAvatar({ showTitle = false, size = "md" }: InfoProps) {
    return (
        <UserPopoverPanel title="System User" description="The system user is used to initialize built-in objects.">
            <Avatar src="/icon.svg" size={size} />
            {showTitle && <div className="text-sm font-semibold pl-2">System User</div>}
        </UserPopoverPanel>
    )
}
interface ServiceInfoProps extends InfoProps {
    accountId: string;
}
function ServiceAccountAvatar({ accountId, showTitle = false, size = "md" }: ServiceInfoProps) {
    const description = (
        <>
            <div>This user is used by robots like workflow workers.</div>
            <div className="text-gray-800 dark:text-gray-500 text-sm"><span className="font-semibold">ID:</span> {accountId}</div>
        </>
    )

    return (
        <UserPopoverPanel title="Service Account" description={description}>
            <div className="flex flex-row items-center gap-2">
                <Avatar src="/cloud.svg" name="SA" color="bg-amber-500" className="px-[5px] text-white" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2 truncate">Service Account : {accountId}</div>}
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
     */
    userRef: string | undefined;
}
export function UserInfo({ userRef, showTitle = false, size = "md" }: UserInfoProps) {
    if (!userRef) {
        return <UnknownAvatar title="Unknown User" message="User information is not available." showTitle={showTitle} size={size} />
    }

    const [type, id] = userRef ? userRef.split(':') : ["unknown"];
    switch (type) {
        case PrincipalType.User:
            return <UserAvatar userId={id} showTitle={showTitle} size={size} />
        case "system":
            return <SystemAvatar showTitle={showTitle} size={size} />
        case PrincipalType.ServiceAccount:
            return <ServiceAccountAvatar accountId={id} showTitle={showTitle} size={size} />
        case PrincipalType.ApiKey:
            return <ApiKeyAvatar keyId={id} size={size} showTitle={showTitle} />
        default:
            return <ErrorAvatar title="Unknown User" error={`Invalid user ref type: ${type}`} showTitle={showTitle} size={size} />
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

interface UserAvatarProps extends InfoProps {
    userId: string;
}
function UserAvatar({ userId, showTitle = false, size = "md" }: UserAvatarProps) {
    const { data: user, error } = useFetchUserInfo(userId);

    if (error) {
        return <ErrorAvatar title="Failed to fetch user" error={error} showTitle={showTitle} size={size} />
    }

    if (!user) {
        return <AvatarPlaceholder />
    }

    const description = (
        <div className="truncate" title={user.email}>{user.email}</div>
    )

    return (
        <UserPopoverPanel title={user.name || user.email || user.username || "unknown"} description={description}>
            <div className="flex flex-row items-center gap-2">
                <Avatar src={user.picture} name={user.name} color="bg-indigo-500" size={size} />
                {showTitle && <div className="text-sm font-semibold pl-2">{user.name || user.email || user.username || "unknown"}</div>}
            </div>
        </UserPopoverPanel>
    )
}

interface ApiKeyAvatarProps extends InfoProps {
    keyId: string;
}
export function ApiKeyAvatar({ keyId, showTitle = false, size = "md" }: ApiKeyAvatarProps) {
    const { client } = useUserSession();
    const { data, error } = useFetch<ApiKey>(() => client.apikeys.retrieve(keyId), []);

    if (error) {
        return <ErrorAvatar title="Failed to fetch the apikey" error={error} showTitle={showTitle} size={size} />
    }

    if (!data) {
        return <AvatarPlaceholder />
    }

    const isPublic = data.type === ApiKeyTypes.public;
    const title = isPublic ? "Public Key" : "Private Key";
    const avatar = <Avatar name={isPublic ? "PK" : "SK"} color="bg-pink-500" size={size} />;
    const description = (
        <Table className="dark:bg-gray-800 dark:text-gray-200 table-fixed w-full">
            <tr>
                <td className="font-semibold w-20">Key:</td>
                <td className="truncate max-w-0">{data?.name}</td>
            </tr>
            <tr>
                <td className="font-semibold w-20">Account:</td>
                <td className="truncate max-w-0">{data?.account}</td>
            </tr>
            <tr>
                <td className="font-semibold w-20">Project:</td>
                <td className="truncate max-w-0">{data?.project}</td>
            </tr>
        </Table>
    );

    return (
        <UserPopoverPanel title={title} description={description}>
            <div className="flex flex-row items-center gap-2">
                {avatar}
                {showTitle && <div className="text-sm font-semibold">{data?.name || data?.account || data?.project || "unknown"}</div>}
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
