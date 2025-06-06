import { useEffect, useState } from 'react';

import { Button, useToast } from '@vertesia/ui/core';
import { FullHeightLayout } from '@vertesia/ui/layout';
import { useUserSession } from '@vertesia/ui/session';
import { GenericPageNavHeader } from "../../layout";
import { ContentObjectTypesSearch } from './ContentObjectTypesSearch';
import { ObjectTypeSearchProvider } from './search/ObjectTypeSearchProvider';

import { CreateOrUpdateTypeModal, CreateOrUpdateTypePayload } from './CreateOrUpdateTypeModal';

export enum ChunkableOptions {
    true = "Yes",
    false = "No"
};

interface ContentObjectTypesViewProps { }
export function ContentObjectTypesView({ }: ContentObjectTypesViewProps) {
    const toast = useToast();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const session = useUserSession();
    const { store } = session;

    const actions = <Button key="create" variant="primary" onClick={() => setShowCreateModal(true)}>Create Type</Button>;

    const [isDirty, setIsDirty] = useState(false);
    useEffect(() => {
        if (isDirty) {
            setIsDirty(false);
        }
    }, [isDirty]);

    const onCloseCreateModal = async (payload?: CreateOrUpdateTypePayload) => {
        if (!payload) {
            setShowCreateModal(false);
            return Promise.resolve();
        }
        return store.types.create(payload).then(async () => {
            toast({
                status: 'success',
                title: 'Type created',
                duration: 2000
            });
            session.reloadTypes();
            setIsDirty(true);
        }).catch(err => {
            toast({
                status: 'error',
                title: 'Error creating type',
                description: err.message,
                duration: 5000
            });
        });
    };

    const breadcrumbs = [
        <span key='0'>Content Type</span>
    ];

    return (
        <FullHeightLayout>
            <GenericPageNavHeader actions={actions} breadcrumbs={breadcrumbs} title="Content Types" />
            <CreateOrUpdateTypeModal okLabel="Create" title="Create Type" isOpen={showCreateModal} onClose={onCloseCreateModal} />
            <ObjectTypeSearchProvider>
                <FullHeightLayout.Body>
                    <ContentObjectTypesSearch isDirty={isDirty}></ContentObjectTypesSearch>
                </FullHeightLayout.Body>
            </ObjectTypeSearchProvider>
        </FullHeightLayout>
    );
}
