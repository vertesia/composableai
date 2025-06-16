import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
import { useState } from 'react';

import { ColumnLayout, ContentObjectType } from '@vertesia/common';
import { Button, Center, ErrorBox, Popover, PopoverContent, PopoverTrigger, Spinner, Switch, Tab, Tabs, TabsBar, TabsPanel, useFetch, useToast } from '@vertesia/ui/core';
import { FullHeightLayout } from '@vertesia/ui/layout';
import { useLocation, useNavigate } from "@vertesia/ui/router";
import { useUserSession } from '@vertesia/ui/session';
import { PropertiesView } from '@vertesia/ui/widgets';
import { EllipsisVertical, SquarePen, Trash2 } from 'lucide-react';
import { GenericPageNavHeader } from "../../layout";
import { UserInfo } from '../../user/UserInfo';

import { CreateOrUpdateTypeModal, CreateOrUpdateTypePayload } from './CreateOrUpdateTypeModal';
import { ObjectSchemaEditor } from './ObjectSchemaEditor';
import { TableLayoutEditor } from './TableLayoutEditor';

dayjs.extend(LocalizedFormat)

interface ContentObjectTypeViewProps {
    typeId: string;
}
export function ContentObjectTypeView({ typeId }: ContentObjectTypeViewProps) {
    const { store, user } = useUserSession();
    const { hash } = useLocation();
    const currentTab = hash ? hash.substring(1) : undefined;

    let { data: objectType, isLoading, error, refetch } = useFetch(() => {
        if (user) {
            return store.types.retrieve(typeId);
        } else {
            return Promise.resolve(undefined);
        }
    }, [user]);

    if (error) {
        return <ErrorBox title="Error">{error.message}</ErrorBox>;
    }

    if (isLoading) {
        return <Center className="py-10"><Spinner size='lg' /></Center>
    }

    if (!objectType) {
        return null;
    }

    const actions = [
        <DeleteTypeButton key="delete" objectType={objectType} />
    ];

    const onSchemaUpdate = (value: any) => {
        objectType.object_schema = value.schema;
    };

    const onLayoutUpdate = (value: ColumnLayout[] | undefined) => {
        objectType.table_layout = value;
    };

    const tabs: Tab[] = [
        { name: 'metadata', label: "Metadata", href: "#metadata", content: <MetadataView objectType={objectType} /> },
        { name: 'schema', label: "Object Schema", href: "#schema", content: <ObjectSchemaEditor objectType={objectType} onSchemaUpdate={onSchemaUpdate} /> },
        { name: 'layout', label: "Table Layout", href: "#layout", content: <TableLayoutEditor objectType={objectType} onLayoutUpdate={onLayoutUpdate} /> },
    ];

    const breadcrumbs = [breadcrumb()];
    const title = pageTitle(objectType, refetch);
    const description = objectType.description;

    return (
        <FullHeightLayout>
            <GenericPageNavHeader title={title} description={description} actions={[actions]} breadcrumbs={breadcrumbs} />
            <Tabs tabs={tabs} current={currentTab}>
                <TabsBar />
                <FullHeightLayout.Body>
                    <div className="h-[calc(100vh-187px)] overflow-auto">
                        <TabsPanel />
                    </div>
                </FullHeightLayout.Body>
            </Tabs>
        </FullHeightLayout>
    );
}

function breadcrumb() {
    return <span>Content Type</span>
}

function pageTitle(objectType: ContentObjectType, refetch: () => Promise<unknown>) {
    return <PageTitle objectType={objectType} refetch={refetch} />
}

function PageTitle({ objectType, refetch }: { objectType: ContentObjectType, refetch: () => Promise<unknown> }) {
    const toast = useToast();
    const session = useUserSession();
    const { store } = session;
    const [showEditModal, setShowEditModal] = useState(false);
    const onCloseEditModal = (payload?: CreateOrUpdateTypePayload) => {
        if (!payload) {
            setShowEditModal(false);
            return Promise.resolve();
        }
        return store.types.update(objectType.id, payload).then(() => {
            toast({
                status: 'success',
                title: 'Type updated',
                duration: 2000
            });
            return refetch().finally(() => session.reloadTypes());
        }).catch(err => {
            toast({
                status: 'error',
                title: 'Error updating type',
                description: err.message,
                duration: 5000
            })
        });
    }
    return <>
        <div className='flex items-center gap-x-2'>{objectType.name} <Button variant="ghost" size="sm" title="Edit" onClick={() => setShowEditModal(true)}><SquarePen className="size-4" /></Button></div>
        <CreateOrUpdateTypeModal okLabel="Save Changes" title="Edit Type" isOpen={showEditModal} onClose={onCloseEditModal} initialPayload={objectType} />
    </>
}

interface MetadataViewProps {
    objectType: ContentObjectType;
}
function MetadataView({ objectType }: MetadataViewProps) {
    return (
        <PropertiesView className='w-full' properties={[
            { name: "Id", value: objectType.id },
            { name: "Description", value: objectType.description ?? ""},
            { name: "Name", value: objectType.name },
            { name: "Is Chunkable", value: <ChunkableSwitch objectType={objectType} /> },
            { name: "Strict Mode", value: <StrictModeSwitch objectType={objectType} /> },
            { name: 'Created By', value: <UserInfo userRef={objectType.created_by} /> },
            { name: 'Created At', value: dayjs(objectType.created_at).format('LLL') },
            { name: 'Updated By', value: <UserInfo userRef={objectType.updated_by} /> },
            { name: 'Updated At', value: dayjs(objectType.updated_at).format('LLL') },
        ]}
        />
    );
}


interface TypeSwitchProps {
    objectType: ContentObjectType;
    field: 'is_chunkable' | 'strict_mode';
    initialValue?: boolean;
}

function TypeSwitch({ objectType, field, initialValue }: TypeSwitchProps) {
    const [value, setValue] = useState(initialValue ?? false);
    const toast = useToast();
    const { store } = useUserSession();

    const onChange = (value: boolean) => {
        store.types.update(objectType.id, {
            [field]: value
        }).then(() => {
            setValue(value);
            toast({
                status: 'success',
                title: 'Successfully Updated.',
                duration: 2000
            })
        }).catch((err) => {
            toast({
                status: 'error',
                title: 'Failed to update.',
                description: err.message,
                duration: 5000
            })
        });
    }

    return (
        <Switch value={value} onChange={onChange} />
    )
}

interface ChunkableSwitchProps {
    objectType: ContentObjectType;
}

function ChunkableSwitch({ objectType }: ChunkableSwitchProps) {
    return (
        <TypeSwitch objectType={objectType} field="is_chunkable" initialValue={objectType.is_chunkable ?? false} />
    )
}

interface StrictModeSwitchProps {
    objectType: ContentObjectType;
}

function StrictModeSwitch({ objectType }: StrictModeSwitchProps) {
    return (
        <TypeSwitch objectType={objectType} field="strict_mode" initialValue={objectType.strict_mode ?? false} />
    )
}
interface DeleteTypeButtonProps {
    objectType: ContentObjectType;
}
function DeleteTypeButton({ objectType }: DeleteTypeButtonProps) {
    const toast = useToast();
    const navigate = useNavigate();
    const { store } = useUserSession();
    const onDelete = () => {
        confirm('Are you sure you want to delete this rule?') &&
            store.types.delete(objectType.id).then(() => {
                toast({
                    status: 'success',
                    title: `Object type ${objectType.name} deleted`,
                    duration: 2000
                });
                navigate('/types');
            }).catch(err => {
                toast(
                    {
                        status: 'error',
                        title: 'Failed to delete rule',
                        description: err.message,
                        duration: 5000
                    }
                )
            })
    }
    return (
        <Popover hover>
            <PopoverTrigger>
                <div className='cursor-pointer hover:bg-muted p-2 rounded-md'>
                    <Button variant="ghost" size='sm' title='More actions'><EllipsisVertical /></Button>
                </div>
            </PopoverTrigger >
            <PopoverContent className='p-0 w-35' align='end'>
                <div className="py-2 px-1.5 flex justify-center w-full">
                    <Button variant="ghost" onClick={onDelete} className='w-full'>
                        <Trash2 className='size-4' /> Delete
                    </Button>
                </div>
            </PopoverContent>
        </Popover >
    )
}