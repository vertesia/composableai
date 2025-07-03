import { getTenantIdFromProject } from "@vertesia/common";
import { Button, Spinner, Table } from "@vertesia/ui/core";
import { Env } from "@vertesia/ui/env";
import { useUserSession } from "@vertesia/ui/session";
import { Popover } from "@vertesia/ui/widgets";
import { useState } from "react";
import { PreviewIcon } from "./PreviewIcon";
import SignInModal from "./SignInModal";
import UserPopoverMenu from "./UserPopoverMenu";

interface UserMenuProps {
}
export default function UserLogin({ }: UserMenuProps) {
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

            <div>
                {Env.isPreview && <div className="absolute right-0 text-gray-200 dark:text-slate-400 text-sm cursor-pointer mb-2"><PreviewIcon className="h-[24px]" /></div>}
                <ServerInfoPopover />
                <UserPopoverMenu name={user.name} picture={user.picture} />
            </div>
        )
    }
}

function ServerInfoPopover() {
    const { client, project, account } = useUserSession();

    const server = new URL(client.baseUrl).hostname;
    const store = new URL(client.store.baseUrl).hostname;
    const tenantId = project ? getTenantIdFromProject(project) : '';

    return (
        <Popover strategy='fixed' placement='bottom-start' zIndex={100}>
            <Popover.Trigger click>
                <div className="hover:text-white text-sm cursor-pointer mb-2">Tenant: {tenantId}</div>
            </Popover.Trigger>
            <Popover.Content>
                <div className="ml-10 bg-white rounded-md shadow-md px-4 py-2 dark:bg-gray-800 dark:text-white">
                    <Table className="w-96">
                        <tr>
                            <th colSpan={2} className="text-lg! font-semibold">Environment Information</th>
                        </tr>
                        <tr>
                            <td className='font-semibold'>Environment:</td>
                            <td>{Env.type}</td>
                        </tr>
                        <tr>
                            <td className='font-semibold'>Server:</td>
                            <td>{server}</td>
                        </tr>
                        <tr>
                            <td className='font-semibold'>Store:</td>
                            <td>{store}</td>
                        </tr>
                        <tr>
                            <td className='font-semibold'>Tenant Id:</td>
                            <td>{tenantId}</td>
                        </tr>
                        <tr>
                            <td className='font-semibold'>Account Id:</td>
                            <td>{account?.id}</td>
                        </tr>
                        <tr>
                            <td className='font-semibold'>Project Id:</td>
                            <td>{project?.id}</td>
                        </tr>
                        <tr>
                            <td className='font-semibold'>App Version:</td>
                            <td>{Env.version}</td>
                        </tr>
                    </Table>
                </div>
            </Popover.Content>
        </Popover>
    )
}
