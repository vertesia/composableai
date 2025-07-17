import { useState } from 'react'

import { AccountRef, ProjectRef } from '@vertesia/common'
import { Button, Center, ErrorBox, Input, SelectBox, Spinner, useFetch, useToast } from '@vertesia/ui/core'
import { Env } from "@vertesia/ui/env"
import { useLocation } from "@vertesia/ui/router"
import { fetchComposableTokenFromFirebaseToken, useUserSession } from '@vertesia/ui/session'

interface ProfileData {
    profile?: string
    account?: string
    project?: string
}

interface LoginResult extends Required<ProfileData> {
    token: string
    studio_server_url: string
    zeno_server_url: string
}

interface ClientInfo extends ProfileData {
    redirect: string
    code: string
}

function getClientInfo(location: Location): ClientInfo | null {
    const params = new URLSearchParams(location.search)
    let redirect = params.get('redirect_uri')
    const code = params.get('code')
    if (!redirect || !code) {
        return null
    }
    redirect = decodeURI(redirect)
    if (!redirect.startsWith('http://127.0.0.1:') && !redirect.startsWith('http://localhost:')) {
        return null
    }
    const profile = params.get('profile') ?? "default"
    const project = params.get('project') ?? undefined
    const account = params.get('account') ?? undefined
    return { redirect, code, profile, project, account }
}

export function TerminalLogin() {
    const [payload, setPayload] = useState<LoginResult | undefined>()
    const [error, setError] = useState<Error>()
    const location = useLocation()
    const clientInfo = getClientInfo(location)
    const toast = useToast()

    const onAccept = async (data: ProfileData) => {
        if (!clientInfo) return
        if (!data.profile) {
            toast({
                title: 'Profile is required',
                description: 'Please enter a profile name to save the client authorization',
                status: 'error',
                duration: 2000
            })
            return
        }
        if (!data.account) {
            toast({
                title: 'Account is required',
                description: 'Please select an account to authorize the client to access the ComposablePrompts servers',
                status: 'error',
                duration: 2000
            })
            return
        }
        if (!data.project) {
            toast({
                title: 'Project is required',
                description: 'Please select a project to authorize the client to access the ComposablePrompts servers',
                status: 'error',
                duration: 2000
            })
            return
        }

        // expire in 1 day
        let payload: LoginResult | undefined
        try {
            const token = await fetchComposableTokenFromFirebaseToken(data.account, data.project, 24 * 3600)
            if (token) {
                payload = {
                    ...data,
                    studio_server_url: Env.endpoints.studio,
                    zeno_server_url: Env.endpoints.zeno,
                    token,
                } as LoginResult
                await fetch(clientInfo.redirect, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                setPayload(payload)
            } else {
                toast({
                    title: 'Failed to get composable token',
                    status: 'error',
                    duration: 5000
                })
            }
        } catch (err: any) {
            if (payload) {
                setError(err)
                setPayload(payload)
            } else {
                toast({
                    title: 'Error authorizing client',
                    description: err.message,
                    status: 'error',
                    duration: 5000
                })
            }
        }
    }

    const getPageContent = () => {
        if (!clientInfo) {
            return <ErrorBox title='Invalid request'>This page should be called by a terminal client to authenticate against the ComposablePrompts servers</ErrorBox>
        }

        return payload
            ? <AuthDoneScreen payload={payload} error={error} />
            : <AuthAcceptScreen clientInfo={clientInfo} onAccept={onAccept} />
    }

    const page = getPageContent()

    return (
        <div className="w-full flex flex-col items-center gap-4 mt-24">{page}</div>
    )
}

interface AuthAcceptScreenProps {
    onAccept: (data: ProfileData) => void
    clientInfo: ClientInfo
}
function AuthAcceptScreen({ onAccept, clientInfo }: Readonly<AuthAcceptScreenProps>) {
    const { client, user } = useUserSession()
    const { data: allProjects, error } = useFetch(() => user ? client.projects.list() : Promise.resolve([]), [user])


    if (error) {
        return <ErrorBox title='Error loading projects'>{error.message}</ErrorBox>
    }

    const getEnvironmentName = () => {
        if (Env.isLocalDev) {
            return "Local Dev"
        } else if (Env.isDev) {
            return "Staging"
        }
        return "Production"
    }

    const envName = getEnvironmentName()

    return user && allProjects ? (
        <>
            <div className='w-1/3'>
                <div className="mb-4 text-xl font-semibold text-gray-800">
                    Authorizing client on {envName} environment.
                </div>
                <div className='mb-2 text-md text-gray-800'>
                    <div>A client app wants authorization to access the composable prompt servers in your name.</div>
                    <div>The client app code is <b>{clientInfo.code}</b>. You can check if the code is correct in the terminal.</div>
                </div>
                <div className='mb-2 text-sm text-gray-600'>
                    <div>You must choose the target account and project for the client to access.</div>
                    <div>Also, enter a profile name that will be used to save the authorization in your client configuration.</div>
                </div>
            </div>
            <ProfileForm onAccept={onAccept} allProjects={allProjects} data={clientInfo} />
        </>
    ) : <Spinner size='lg' />
}

function AuthDoneScreen({ payload, error }: Readonly<{ payload: LoginResult, error?: Error }>) {
    const toast = useToast()
    const onCopy = () => {
        if (payload) {
            navigator.clipboard.writeText(JSON.stringify(payload))
            toast({
                title: 'Authentication Payload copied',
                description: error ? 'You can paste the authentication payload in the terminal to authenticate the client.' : 'You can close the page now.',
                status: 'success',
                duration: 5000
            })
        }
    }

    return (
        <div>
            {
                error ?
                    <div>
                        <ErrorBox title='Failed to send the authorization token to the cli tool'>This can happen due to security checks on Safari. The error is &quot;{error.message}&quot;</ErrorBox>
                        <div>Don&apos;t worry, you can still authenticate the cli tool by pasting the authentication token in the terminal.
                            You can close this page.</div>
                    </div>
                    : <div>The client is authenticated. You can close this page.</div>
            }
            <Center className="mt-4">
                <Button variant='secondary' onClick={onCopy}>Copy the Authentication Payload</Button>
            </Center>
        </div>
    )
}

interface ProfileFormProps {
    onAccept: (data: ProfileData) => void
    allProjects: ProjectRef[]
    data: ProfileData
}
function ProfileForm({ allProjects, data, onAccept }: Readonly<ProfileFormProps>) {
    const { accounts, account, project } = useUserSession()
    const [currentData, setCurrentData] = useState<ProfileData>(() => ({
        profile: data.profile,
        account: data.account ?? account?.id,
        project: data.project ?? project?.id,
    }))

    const onChangeProfile = (value: string) => {
        setCurrentData({ ...currentData, profile: value })
    }

    const onChangeAccount = (value: AccountRef) => {
        setCurrentData({ ...currentData, account: value.id, project: undefined })
    }

    const onChangeProject = (value: ProjectRef) => {
        setCurrentData({ ...currentData, project: value.id })
    }

    const projects = allProjects.filter(p => p.account === currentData.account)

    return (
        <div className='w-1/3'>
            <div className="mb-4 flex flex-col gap-2">
                <span className="font-semibold text-gray-600">Profile Name</span>
                <Input type='text' value={currentData.profile} onChange={onChangeProfile} />
            </div>
            <div className="mb-4 flex flex-col gap-2">
                <span className="font-semibold text-gray-600">Account</span>
                <SelectAccount value={currentData.account} onChange={onChangeAccount} accounts={accounts || []} />
            </div>
            <div className="mb-4 flex flex-col gap-2">
                <span className="font-semibold text-gray-600">Project</span>
                <SelectProject value={currentData.project} onChange={onChangeProject} projects={projects} />
            </div>
            <div className="pt-2">
                <Button size='xl' onClick={() => onAccept(currentData)}>Authorize Client</Button>
            </div>
        </div>
    )
}

interface SelectAccountProps {
    value?: string
    accounts: AccountRef[]
    onChange: (value: AccountRef) => void
}
function SelectAccount({ value, accounts, onChange }: Readonly<SelectAccountProps>) {
    const _onChange = (value: AccountRef) => {
        onChange(value)
    }
    return <SelectBox
        options={accounts}
        value={accounts?.find(a => a.id === value)}
        onChange={_onChange}
        by="id"
        optionLabel={(option) => option.name}
        placeholder='Select Account'
    />
}

interface SelectProjectProps {
    value?: string
    projects: ProjectRef[]
    onChange: (value: ProjectRef) => void
}
function SelectProject({ value, projects, onChange }: Readonly<SelectProjectProps>) {
    const _onChange = (value: ProjectRef) => {
        onChange(value)
    }
    return (
        <SelectBox
            by="id"
            value={projects.find(p => p.id === value)}
            options={projects}
            optionLabel={(option) => option.name}
            placeholder='Select Project'
            onChange={_onChange} />
    )
}
