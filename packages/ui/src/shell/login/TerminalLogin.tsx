import type { AccountRef, ProjectRef } from '@vertesia/common';
import {
    Button,
    Center,
    ErrorBox,
    errorMessage,
    FormItem,
    Input,
    SelectBox,
    useFetch,
    useToast,
} from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useLocation } from '@vertesia/ui/router';
import { fetchComposableTokenFromVertesiaToken, useUserSession } from '@vertesia/ui/session';
import { useContext, useState } from 'react';
import { BrandedAuthLoadingScreen } from '../BrandedAuthScreens';
import { BrandingContext } from '../BrandedLoadingIndicator';
import { SignInPageShell } from './SignInPageShell';

interface ProfileData {
    profile?: string;
    account?: string;
    project?: string;
}

interface LoginResult extends Required<ProfileData> {
    token: string;
    studio_server_url: string;
    zeno_server_url: string;
    oauth_server_url: string;
}

interface ClientInfo extends ProfileData {
    redirect: string;
    code: string;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

function parseRedirectUri(rawRedirect: string | null): string | null {
    if (!rawRedirect) {
        return null;
    }

    let decoded: string;
    try {
        decoded = decodeURIComponent(rawRedirect);
    } catch {
        return null;
    }

    let parsed: URL;
    try {
        parsed = new URL(decoded);
    } catch {
        return null;
    }

    if (parsed.protocol !== 'http:') {
        return null;
    }

    if (!parsed.port) {
        return null;
    }

    if (parsed.username || parsed.password) {
        return null;
    }

    if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
        return null;
    }

    return parsed.toString();
}

function getClientInfo(location: Location): ClientInfo | null {
    const params = new URLSearchParams(location.search);
    const redirect = parseRedirectUri(params.get('redirect_uri'));
    const code = params.get('code');
    if (!redirect || !code) {
        return null;
    }
    const profile = params.get('profile') ?? 'default';
    const project = params.get('project') ?? undefined;
    const account = params.get('account') ?? undefined;
    return { redirect, code, profile, project, account };
}

export function TerminalLogin() {
    const session = useUserSession();
    const brand = useContext(BrandingContext);
    const [payload, setPayload] = useState<LoginResult | undefined>();
    const [error, setError] = useState<Error>();
    const location = useLocation();
    const clientInfo = getClientInfo(location);
    const { data: allProjects, error: projectsError } = useFetch(
        () => (session.user ? session.client.projects.list() : Promise.resolve([])),
        { deps: [session.user], condition: () => !!clientInfo },
    );
    const toast = useToast();
    const { t } = useUITranslation();

    const onAccept = async (data: ProfileData) => {
        if (!clientInfo) return;
        if (!data.profile) {
            toast({
                title: t('login.terminal.profileRequired'),
                description: t('login.terminal.profileRequiredDesc'),
                status: 'error',
                duration: 2000,
            });
            return;
        }
        if (!data.account) {
            toast({
                title: t('login.terminal.accountRequired'),
                description: t('login.terminal.accountRequiredDesc'),
                status: 'error',
                duration: 2000,
            });
            return;
        }
        if (!data.project) {
            toast({
                title: t('login.terminal.projectRequired'),
                description: t('login.terminal.projectRequiredDesc'),
                status: 'error',
                duration: 2000,
            });
            return;
        }

        // expire in 1 day
        let payload: LoginResult | undefined;
        try {
            // Resolve the active session through the shared provider (OAuth, Firebase or central auth).
            // Exchange it server-side for the selected project rather than handing the browser's token to the CLI.
            const token = await fetchComposableTokenFromVertesiaToken(
                await session.rawAuthToken,
                data.account,
                data.project,
                24 * 3600,
            );
            if (token) {
                payload = {
                    ...data,
                    studio_server_url: Env.endpoints.studio,
                    zeno_server_url: Env.endpoints.zeno,
                    oauth_server_url: Env.endpoints.sts,
                    token,
                } as LoginResult;
                await fetch(clientInfo.redirect, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
                setPayload(payload);
            } else {
                toast({
                    title: t('login.terminal.failedToGetToken'),
                    status: 'error',
                    duration: 5000,
                });
            }
        } catch (err: unknown) {
            if (payload) {
                setError(err instanceof Error ? err : new Error(errorMessage(err)));
                setPayload(payload);
            } else {
                toast({
                    title: t('login.terminal.errorAuthorizingClient'),
                    description: errorMessage(err),
                    status: 'error',
                    duration: 5000,
                });
            }
        }
    };

    const getPageContent = () => {
        if (!clientInfo) {
            return (
                <ErrorBox title={t('login.terminal.invalidRequest')}>{t('login.terminal.invalidRequestDesc')}</ErrorBox>
            );
        }

        if (projectsError) {
            return <ErrorBox title={t('login.terminal.errorLoadingProjects')}>{errorMessage(projectsError)}</ErrorBox>;
        }

        return payload ? (
            <AuthDoneScreen payload={payload} error={error} />
        ) : (
            <AuthAcceptScreen clientInfo={clientInfo} onAccept={onAccept} allProjects={allProjects ?? []} />
        );
    };

    if (clientInfo && !projectsError && (!session.user || !allProjects)) {
        return <BrandedAuthLoadingScreen />;
    }
    const page = getPageContent();

    return (
        <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
            <SignInPageShell
                lightLogo={brand.logo?.light}
                darkLogo={brand.logo?.dark ?? brand.logo?.light}
                logoAlt={brand.logo?.alt ?? brand.name}
                footer={brand.copy?.footer}
            >
                <div className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
                    {page}
                </div>
            </SignInPageShell>
        </div>
    );
}

interface AuthAcceptScreenProps {
    allProjects: ProjectRef[];
    onAccept: (data: ProfileData) => void;
    clientInfo: ClientInfo;
}
function AuthAcceptScreen({ onAccept, clientInfo, allProjects }: Readonly<AuthAcceptScreenProps>) {
    const { t } = useUITranslation();

    const getEnvironmentName = () => {
        if (Env.isLocalDev) {
            return t('login.terminal.envLocalDev');
        } else if (Env.isDev) {
            return t('login.terminal.envStaging');
        }
        return t('login.terminal.envProduction');
    };

    const envName = getEnvironmentName();

    return (
        <>
            <div className="w-full">
                <div className="mb-4 text-xl font-semibold text-info">Authorizing client on {envName} environment.</div>
                <div className="mb-2 text-base text-muted">
                    <div>{t('login.terminal.clientWantsAuth')}</div>
                    <div>
                        The client app code is <b className="text-foreground">{clientInfo.code}</b>. You can check if
                        the code is correct in the terminal.
                    </div>
                </div>
                <div className="mb-2 text-sm text-muted">
                    <div>{t('login.terminal.chooseAccountProject')}</div>
                    <div>{t('login.terminal.profileNameNote')}</div>
                </div>
            </div>
            <ProfileForm onAccept={onAccept} allProjects={allProjects} data={clientInfo} />
        </>
    );
}

function AuthDoneScreen({ payload, error }: Readonly<{ payload: LoginResult; error?: Error }>) {
    const toast = useToast();
    const { t } = useUITranslation();
    const onCopy = () => {
        if (payload) {
            navigator.clipboard.writeText(JSON.stringify(payload));
            toast({
                title: t('login.terminal.authPayloadCopied'),
                description: error
                    ? t('login.terminal.authPayloadCopiedWithError', { error: error.message })
                    : t('login.terminal.authPayloadCopiedSuccess'),
                status: 'success',
                duration: 5000,
            });
        }
    };

    return (
        <div>
            {error ? (
                <div>
                    <ErrorBox title={t('login.terminal.failedToSendToken')}>
                        {t('login.terminal.failedToSendTokenDesc', { error: error.message })}
                    </ErrorBox>
                </div>
            ) : (
                <div>{t('login.terminal.clientAuthenticated')}</div>
            )}
            <Center className="mt-4">
                <Button variant="secondary" onClick={onCopy}>
                    {t('login.terminal.copyAuthPayload')}
                </Button>
            </Center>
        </div>
    );
}

interface ProfileFormProps {
    onAccept: (data: ProfileData) => void;
    allProjects: ProjectRef[];
    data: ProfileData;
}
function ProfileForm({ allProjects, data, onAccept }: Readonly<ProfileFormProps>) {
    const { accounts, account, project } = useUserSession();
    const { t } = useUITranslation();
    const [currentData, setCurrentData] = useState<ProfileData>(() => ({
        profile: data.profile,
        account: data.account ?? account?.id,
        project: data.project ?? project?.id,
    }));

    const onChangeProfile = (value: string) => {
        setCurrentData({ ...currentData, profile: value });
    };

    const onChangeAccount = (value: AccountRef) => {
        setCurrentData({ ...currentData, account: value.id, project: undefined });
    };

    const onChangeProject = (value: ProjectRef) => {
        setCurrentData({ ...currentData, project: value.id });
    };

    const projects = allProjects.filter((p) => p.account === currentData.account);

    return (
        <div className="w-full">
            <FormItem className="mb-4" label={t('login.terminal.profileName')}>
                <Input type="text" value={currentData.profile} onChange={onChangeProfile} />
            </FormItem>
            <FormItem className="mb-4" label={t('login.terminal.account')}>
                <SelectAccount value={currentData.account} onChange={onChangeAccount} accounts={accounts || []} />
            </FormItem>
            <FormItem className="mb-4" label={t('login.terminal.project')}>
                <SelectProject value={currentData.project} onChange={onChangeProject} projects={projects} />
            </FormItem>
            <div className="mb-4 text-sm text-attention">{t('login.terminal.browserPermissionNote')}</div>
            <div>
                <Button size="xl" onClick={() => onAccept(currentData)}>
                    {t('login.terminal.authorizeClient')}
                </Button>
            </div>
        </div>
    );
}

interface SelectAccountProps {
    id?: string;
    value?: string;
    accounts: AccountRef[];
    onChange: (value: AccountRef) => void;
}
function SelectAccount({ id, value, accounts, onChange }: Readonly<SelectAccountProps>) {
    const { t } = useUITranslation();
    const _onChange = (value: AccountRef) => {
        onChange(value);
    };
    return (
        <SelectBox
            id={id}
            options={accounts}
            value={accounts?.find((a) => a.id === value)}
            onChange={_onChange}
            by="id"
            optionLabel={(option) => option.name}
            placeholder={t('login.terminal.selectAccount')}
        />
    );
}

interface SelectProjectProps {
    id?: string;
    value?: string;
    projects: ProjectRef[];
    onChange: (value: ProjectRef) => void;
}
function SelectProject({ id, value, projects, onChange }: Readonly<SelectProjectProps>) {
    const { t } = useUITranslation();
    const _onChange = (value: ProjectRef) => {
        onChange(value);
    };
    return (
        <SelectBox
            id={id}
            by="id"
            value={projects.find((p) => p.id === value)}
            options={projects}
            optionLabel={(option) => option.name}
            placeholder={t('login.terminal.selectProject')}
            onChange={_onChange}
        />
    );
}
