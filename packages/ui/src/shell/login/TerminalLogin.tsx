import { AccountRef, ProjectRef } from '@vertesia/common'
import { Button, Center, ErrorBox, Input, SelectBox, Spinner, useFetch, useToast } from '@vertesia/ui/core'
import { Env } from "@vertesia/ui/env"
import { useLocation } from "@vertesia/ui/router"
import { fetchComposableTokenFromFirebaseToken, useUserSession } from '@vertesia/ui/session'
import { useState } from 'react'
import { useUITranslation } from '../../i18n/index.js'

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

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

function parseRedirectUri(rawRedirect: string | null): string | null {
    if (!rawRedirect) {
        return null
    }

    let decoded: string
    try {
        decoded = decodeURIComponent(rawRedirect)
    } catch {
        return null
    }

    let parsed: URL
    try {
        parsed = new URL(decoded)
    } catch {
        return null
    }

    if (parsed.protocol !== 'http:') {
        return null
    }

    if (!parsed.port) {
        return null
    }

    if (parsed.username || parsed.password) {
        return null
    }

    if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
        return null
    }

    return parsed.toString()
}

function getClientInfo(location: Location): ClientInfo | null {
    const params = new URLSearchParams(location.search)
    const redirect = parseRedirectUri(params.get('redirect_uri'))
    const code = params.get('code')
    if (!redirect || !code) {
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
    const { t } = useUITranslation()

    const onAccept = async (data: ProfileData) => {
        if (!clientInfo) return
        if (!data.profile) {
            toast({
                title: t('login.terminal.profileRequired'),
                description: t('login.terminal.profileRequiredDesc'),
                status: 'error',
                duration: 2000
            })
            return
        }
        if (!data.account) {
            toast({
                title: t('login.terminal.accountRequired'),
                description: t('login.terminal.accountRequiredDesc'),
                status: 'error',
                duration: 2000
            })
            return
        }
        if (!data.project) {
            toast({
                title: t('login.terminal.projectRequired'),
                description: t('login.terminal.projectRequiredDesc'),
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
                    title: t('login.terminal.failedToGetToken'),
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
                    title: t('login.terminal.errorAuthorizingClient'),
                    description: err.message,
                    status: 'error',
                    duration: 5000
                })
            }
        }
    }

    const getPageContent = () => {
        if (!clientInfo) {
            return <ErrorBox title={t('login.terminal.invalidRequest')}>{t('login.terminal.invalidRequestDesc')}</ErrorBox>
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
    const { t } = useUITranslation()

    if (error) {
        return <ErrorBox title={t('login.terminal.errorLoadingProjects')}>{error.message}</ErrorBox>
    }

    const getEnvironmentName = () => {
        if (Env.isLocalDev) {
            return t('login.terminal.envLocalDev')
        } else if (Env.isDev) {
            return t('login.terminal.envStaging')
        }
        return t('login.terminal.envProduction')
    }

    const envName = getEnvironmentName()

    return user && allProjects ? (
        <>
            <div className='w-1/3'>
                <div className="mb-4 text-xl font-semibold text-info">
                    Authorizing client on {envName} environment.
                </div>
                <div className='mb-2 text-md text-muted-foreground'>
                    <div>{t('login.terminal.clientWantsAuth')}</div>
                    <div>The client app code is <b className="text-foreground">{clientInfo.code}</b>. You can check if the code is correct in the terminal.</div>
                </div>
                <div className='mb-2 text-sm text-muted-foreground'>
                    <div>{t('login.terminal.chooseAccountProject')}</div>
                    <div>{t('login.terminal.profileNameNote')}</div>
                </div>
            </div>
            <ProfileForm onAccept={onAccept} allProjects={allProjects} data={clientInfo} />
        </>
    ) : <Spinner size='lg' />
}

function AuthDoneScreen({ payload, error }: Readonly<{ payload: LoginResult, error?: Error }>) {
    const toast = useToast()
    const { t } = useUITranslation()
    const onCopy = () => {
        if (payload) {
            navigator.clipboard.writeText(JSON.stringify(payload))
            toast({
                title: t('login.terminal.authPayloadCopied'),
                description: error ? t('login.terminal.authPayloadCopiedWithError', { error: error.message }) : t('login.terminal.authPayloadCopiedSuccess'),
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
                        <ErrorBox title={t('login.terminal.failedToSendToken')}>{t('login.terminal.failedToSendTokenDesc', { error: error.message })}</ErrorBox>
                    </div>
                    : <div>{t('login.terminal.clientAuthenticated')}</div>
            }
            <Center className="mt-4">
                <Button variant='secondary' onClick={onCopy}>{t('login.terminal.copyAuthPayload')}</Button>
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
    const { t } = useUITranslation()
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
                <span className="font-semibold text-muted-foreground">{t('login.terminal.profileName')}</span>
                <Input type='text' value={currentData.profile} onChange={onChangeProfile} />
            </div>
            <div className="mb-4 flex flex-col gap-2">
                <span className="font-semibold text-muted-foreground">{t('login.terminal.account')}</span>
                <SelectAccount value={currentData.account} onChange={onChangeAccount} accounts={accounts || []} />
            </div>
            <div className="mb-4 flex flex-col gap-2">
                <span className="font-semibold text-muted-foreground">{t('login.terminal.project')}</span>
                <SelectProject value={currentData.project} onChange={onChangeProject} projects={projects} />
            </div>
            <div className='mb-4 text-sm text-attention'>
                {t('login.terminal.browserPermissionNote')}
            </div>
            <div>
                <Button size='xl' onClick={() => onAccept(currentData)}>{t('login.terminal.authorizeClient')}</Button>
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
    const { t } = useUITranslation()
    const _onChange = (value: AccountRef) => {
        onChange(value)
    }
    return <SelectBox
        options={accounts}
        value={accounts?.find(a => a.id === value)}
        onChange={_onChange}
        by="id"
        optionLabel={(option) => option.name}
        placeholder={t('login.terminal.selectAccount')}
    />
}

interface SelectProjectProps {
    value?: string
    projects: ProjectRef[]
    onChange: (value: ProjectRef) => void
}
function SelectProject({ value, projects, onChange }: Readonly<SelectProjectProps>) {
    const { t } = useUITranslation()
    const _onChange = (value: ProjectRef) => {
        onChange(value)
    }
    return (
        <SelectBox
            by="id"
            value={projects.find(p => p.id === value)}
            options={projects}
            optionLabel={(option) => option.name}
            placeholder={t('login.terminal.selectProject')}
            onChange={_onChange} />
    )
}
