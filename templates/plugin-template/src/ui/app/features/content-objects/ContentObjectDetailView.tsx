import { ErrorBox, Spinner, useFetch } from '@vertesia/ui/core';
import { ContentOverview, GenericPageNavHeader } from '@vertesia/ui/features';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink, useParams } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import type { ContentObject } from '@vertesia/common';

export function ContentObjectDetailView() {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const { id } = useParams() as { id?: string };

    const { data: object, isLoading, error, refetch } = useFetch<ContentObject | undefined>(
        () => (id ? client.store.objects.retrieve(id) : Promise.resolve(undefined)),
        [id],
    );

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <ErrorBox title={t('objects.detail.loadError')}>{String(error)}</ErrorBox>
            </div>
        );
    }

    if (!object) {
        return (
            <div className="p-4">
                <ErrorBox title={t('objects.detail.notFound')}>{id ?? ''}</ErrorBox>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <GenericPageNavHeader
                useDynamicBreadcrumbs={false}
                breadcrumbs={[
                    <NavLink key="root" href="/objects">
                        {t('nav.objects')}
                    </NavLink>,
                    <span key="current" title={object.name || object.id}>
                        <span className="inline-block align-middle max-w-[60ch] truncate">
                            {object.name || object.id}
                        </span>
                    </span>,
                ]}
            />
            <div className="flex-1 min-h-0">
                <ContentOverview object={object} loadText refetch={refetch} />
            </div>
        </div>
    );
}
