import { AuthTokenPayload, Permission } from "@vertesia/common";
import { Avatar, Button, MenuList, ModeToggle, Spinner } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { Popover } from "@vertesia/ui/widgets";
import clsx from "clsx";
import { useState } from "react";
import SignInModal from "./SignInModal";
import InfoList from "./UserInfo";
import { useNavigate } from "@vertesia/ui/router";
import { useUserPermissions } from "@vertesia/ui/features";
interface UserSessionMenuProps {
    name?: string
    picture?: string;
    user?: AuthTokenPayload;
}
export function UserSessionMenu({ }: UserSessionMenuProps) {
    const { user, isLoading } = useUserSession();
    const [showModal, setShowModal] = useState(false)

    if (isLoading) {
        return <Spinner />
    } else if (!user) {
        return <>
            <Button onClick={() => setShowModal(true)}>Sign In</Button>
            <SignInModal isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    } else {
        return (

            <div className="px-3">
                <UserSessionPopup asMenuTrigger />
            </div>
        )
    }
}

interface UserSessionPopupProps {
    asMenuTrigger?: boolean
    className?: string
}
function UserSessionPopup({ className, asMenuTrigger = false }: UserSessionPopupProps) {
    const session = useUserSession();
    const navigate = useNavigate();
    const perms = useUserPermissions();
    const { user } = session;
    if (!session || !user) return null;

    const isProjectManager = perms.hasPermission(Permission.project_admin);

    return (
        <Popover strategy='fixed' placement='bottom-start' zIndex={100}>
            <Popover.Trigger click>
                <div className={clsx(className, "flex items-center justify-start", asMenuTrigger && "cursor-pointer")}>
                    <Avatar
                        size='sm'
                        color='bg-amber-500'
                        shape='circle'
                        /*src={picture} */
                        name={user?.name} />
                </div>
            </Popover.Trigger>
            <Popover.Content className="w-[280px] mx-2 my-1">
                <div className="bg-white dark:bg-slate-900 shadow-lg rounded-md ring-1 ring-gray-200 dark:ring-slate-700">
                    <div className='divide-y divide-gray-200 dark:divide-slate-700'>
                        <div className='py-2 pl-2'>
                            <p className="px-4 dark:text-white mb-1">{user?.name ?? 'Unknown'}</p>
                            <p className="px-4 text-xs text-gray-500">{user?.email ?? ''}</p>
                        </div>
                        <div className="w-full p-1" >
                            <InfoList />
                        </div>
                        <div className='py-2 pl-2'>
                            <ModeToggle />
                        </div>
                        <div className='py-2'>
                            <MenuList>
                                {isProjectManager && (
                                    <MenuList.Item className='px-2' onClick={() => navigate('/settings', { replace: true })}>
                                        Settings
                                    </MenuList.Item>
                                )}
                                <MenuList.Item className='px-2' onClick={() => session.logout()}>
                                    Sign out
                                </MenuList.Item>
                            </MenuList>
                        </div>
                    </div >
                </div >
            </Popover.Content>
        </Popover>
    )
}
