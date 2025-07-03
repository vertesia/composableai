import clsx from 'clsx';
import { useState } from 'react';

import { AccountRef, AuthTokenPayload, Permission } from '@vertesia/common';
import { Avatar, MenuList, useToast } from '@vertesia/ui/core';
import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';

import { AnyOf, UserAvatar, useUserPermissions } from '@vertesia/ui/features';
import { useUserSession } from '@vertesia/ui/session';
import { Popover } from "@vertesia/ui/widgets";
import { isVertesiaEmail } from '../utils';

interface UserPopoverMenuProps {
    name?: string
    picture?: string;
}
export default function UserPopoverMenu({ name }: UserPopoverMenuProps) {
    return (
        <Popover strategy='fixed' placement='bottom-start' zIndex={100}>
            <Popover.Trigger click>
                <span className="sr-only">Open user menu</span>
                <AccountHeader asMenuTrigger>{name}</AccountHeader>
            </Popover.Trigger>
            <Popover.Content>
                <PopoverContent />
            </Popover.Content>
        </Popover>
    )
}

interface AccountHeaderProps {
    children?: React.ReactNode | React.ReactNode[]
    asMenuTrigger?: boolean
    className?: string
}
function AccountHeader({ className, children, asMenuTrigger = false }: AccountHeaderProps) {
    const { account } = useUserSession();

    // const titleColor = asMenuTrigger ? 'text-gray-50 dark:text-slate-200' : 'text-gray-900 dark:text-slate-50';
    // const subtitleColor = asMenuTrigger ? 'text-gray-300 dark:text-slate-300' : 'text-gray-500  dark:text-slate-200';
    return (
        <div className='flex flex-col'>
            <div className={clsx(className, "flex items-center justify-start", asMenuTrigger && "cursor-pointer")}>
                <Avatar
                    size='xl'
                    color='bg-amber-500'
                    shape='rect'
                    /*src={picture} */
                    name={account?.name} />
                <div className={clsx("ml-4 flex flex-col items-start")}>
                    <div className="hidden lg:flex lg:items-center">
                        <div className="text-md font-semibold leading-6">
                            {account?.name}
                        </div>
                        {asMenuTrigger && <ChevronDown className="ml-2 size-4" />}
                    </div>
                    <div className={clsx("text-sm")}>
                        {children}
                    </div>

                </div>
            </div>
        </div>
    )
}

interface UserHeaderProps {
    user?: AuthTokenPayload
    className?: string
}
function UserHeader({ className, user }: UserHeaderProps) {
    return (
        <div className={`${className} flex items-center justify-start py-3`}>
            {user && <UserAvatar user={user} />}
        </div>
    )
}

interface PopoverContentProps {
}
function PopoverContent({ }: PopoverContentProps) {
    const session = useUserSession();
    const { account, accounts, project, user, authToken } = session;

    const doSwitchAccount = (accountId: string) => {
        console.log("doSwitchAccount: ", accountId, accounts, session);
        session.switchAccount(accountId);
    }

    const perms = useUserPermissions();

    if (!session || !user) return null;

    const hasMultiAccounts = user.accounts.length > 1;

    const isVertesiaAccount = isVertesiaEmail(user.email);

    const settingPermission = perms.hasPermission(AnyOf(Permission.project_manage, Permission.account_manage));

    return (
        <div className="bg-white dark:bg-slate-900 py-4 shadow-lg rounded-md min-w-[16rem]">
            <div className='divide-y divide-gray-200 dark:divide-slate-700'>
                <div>
                    <MenuList className='py-2 pl-2'>
                        <div className='text-xs px-4 dark:text-slate-200'>Organization ID: {account?.id}</div>
                        <div className='text-xs px-4 dark:text-slate-200'>Project ID: {project?.id}</div>
                        <div className='text-xs px-4 dark:text-slate-200'>User ID: {authToken?.sub}</div>
                        <div className='text-xs px-4 dark:text-slate-200'>Organization Roles: {authToken?.account_roles?.join(',')}</div>
                        <div className='text-xs px-4 dark:text-slate-200'>Project Roles: {authToken?.project_roles?.join(',')}</div>
                        {settingPermission && <MenuList.Item className='px-4' href='/settings'>Settings</MenuList.Item>}
                        {/* <MenuList.Item className='px-4' href='/settings'>Settings</MenuList.Item> */}
                        {hasMultiAccounts &&
                            <SwitchAccountMenu account={account} accounts={user.accounts} switchAccount={doSwitchAccount} />
                        }
                        {isVertesiaAccount &&
                            <CreateAccountModal />
                        }
                    </MenuList>
                </div>
                <div>
                    <UserHeader user={user} className="px-4" />
                    <MenuList className='pl-2'>
                        <MenuList.Item className='px-4' onClick={() => session.logout()}>Sign out</MenuList.Item>
                    </MenuList>
                </div>
            </div >
        </div >
    )
}


interface SwitchAccountMenuProps {
    account: AccountRef | undefined;
    accounts: AccountRef[]
    switchAccount: (accountId: string, projectId?: string) => void
}
function SwitchAccountMenu({ account, accounts, switchAccount }: SwitchAccountMenuProps) {

    const [isOpen, setIsOpen] = useState(accounts.length < 6)

    return (
        <div className='w-full'>
            <MenuList.Item className='w-full' onClick={() => setIsOpen(!isOpen)}>
                <div>Switch Organization</div>
                <div className='ml-auto'>
                    {isOpen ? <ChevronDown className='size-4' /> : <ChevronRight className='size-4' />}
                </div>
            </MenuList.Item>
            {/*<CollapseAnimation isOpen={isOpen}>*/}
            <ul className={isOpen ? "overflow-y-auto block h-60" : "hidden"}>
                {
                    accounts.map((acc) => {
                        const isDisabled = acc.id === account?.id;
                        return <MenuList.Item
                            className='px-4'
                            key={acc.id}
                            onClick={() => {
                                !isDisabled && switchAccount(acc.id)
                            }}
                        >
                            <Check className={clsx(!isDisabled && "invisible", "size-4")} />
                            <div>{acc.name}</div>
                        </MenuList.Item>
                    })
                }

            </ul>
            {/*</CollapseAnimation>*/}
        </div>
    )
    /*
        return (
            <div className="bg-white dark:bg-slate-600 py-2 shadow-lg divide-y divide-gray-200 dark:divide-slate-800">
                <MenuList>
                    {
                        user?.accounts && user.accounts.length > 1 && user.accounts.map((acc) => {
                            const isDisabled = acc.id === account?.id;
                            return <MenuList.Item
                                className='px-4'
                                key={acc.id}
                                onClick={() => {
                                    !isDisabled && switchAccount(acc.id)
                                }}
                            >
                                <Check className={clsx(!isDisabled && "invisible", "size-4")} />
                                <div>{acc.name}</div>
                            </MenuList.Item>
                        })
                    }
                </MenuList>
                <MenuList>
                    <MenuList.Item className="px-4"><Plus className='size-4' /> Create a new organization</MenuList.Item>
                </MenuList>
            </div>
        )
        */
}

/*
interface CollapseAnimationProps {
    isOpen: boolean
    children: React.ReactNode | React.ReactNode[]
}
function CollapseAnimation({ isOpen, children }: CollapseAnimationProps) {
    return (
        <div className='overflow-y-hidden relative'>
            <Transition
                className='relative'
                unmount={false}
                show={isOpen}
                enter="transition-top duration-1000 ease-out"
                enterFrom="transform opacity-0 -t-[100%]"
                enterTo="transform opacity-100 t-0"
                leave="transition-top duration-1000 ease-out"
                leaveFrom="transform opacity-100 t-0"
                leaveTo="transform opacity-0 -t-[100%]]"
            >
                {children}
            </Transition>
        </div>
    )
}
*/

interface CreateAccountModalProps {
}
function CreateAccountModal({ }: CreateAccountModalProps) {
    const toast = useToast();
    const { client, switchAccount } = useUserSession();
    // const { on, off, isOn } = useFlag();
    // const [name, setName] = useState('');

    const doCreate = (name: string) => {
        return client.accounts.create(name).then(r => {
            switchAccount(r.id);
        }).catch((err) => {
            toast({
                status: 'error',
                title: 'Error creating organization',
                description: err.message,
                duration: 9000
            });
        })
    }

    /*
    const onCreate = () => {
        if (isCreating) return;
        setIsCreating(true);

        const value = name.trim();
        if (!value) {
            toast({
                status: 'error',
                title: 'Error creating organization',
                description: 'Please enter a name for the organization',
                duration: 5000
            })
            return;
        }

        doCreate(value);
    }
*/

    const onOpen = () => {
        const r = window.prompt('Enter a name for the organization');
        if (r && r.trim()) {
            doCreate(r.trim());
        }
    }

    return (
        <>
            <MenuList.Item className="px-4" onClick={onOpen}><Plus className='size-4' />Create a new organization</MenuList.Item>
            {/*
            <Modal isOpen={isOn} onClose={off} >
                <ModalTitle>Create an Organization</ModalTitle>
                <ModalBody>
                    <div className="mb-2">
                        Enter a name for the organization
                    </div>
                    <div>
                        <Input className="w-full" label='Enter a name for the organization' value={name} onChange={setName} />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant='secondary' onClick={off}>Cancel</Button>
                    <Button isLoading={isCreating} onClick={onCreate} isDisabled={!name.trim()}>Create</Button>
                </ModalFooter>
            </Modal>
            */}
        </>
    )
}
