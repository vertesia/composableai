import { useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useCallback, useState } from "react";
import { ExportPropertiesModal, ExportTypes } from "../../ExportPropertiesModal";
import { useObjectsActionCallback } from "../ObjectsActionContext";
import { ActionComponentTypeProps, ObjectsActionSpec } from "../ObjectsActionSpec";

export function ExportPropertiesComponent({ action, objectIds }: ActionComponentTypeProps) {
    const { store } = useUserSession();
    const toast = useToast();
    const [isOpen, setOpen] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const callback = useCallback(() => {
        setOpen(true);
        return Promise.resolve(true);
    }, [])

    const ctx = useObjectsActionCallback(action.id, callback);

    const onExportType = (exportType?: string | null | undefined, exportAll?: boolean) => {
        if (exportType && (exportAll || objectIds.length > 0)) {
            setIsExporting(true);

            const query = ctx.params?.search?.query || {};
            const search_objectIds = ctx.params?.search?.result?.value?.objects?.map(obj => obj.id) || undefined;

            const getChildObjects = async (objectId: string) => {
                return store.objects.list({
                    query: {
                        parent: objectId,
                    }
                }).then((response) => {
                    return response.map(obj => obj.id);
                });
            }

            const getObjectIds = async () => {
                if (exportAll) {
                    // If there is a vector search use that.
                    if (search_objectIds) {
                        return query.vector ? search_objectIds : [];
                    }
                    // Nothing is selected, export all objects.
                    if (objectIds.length === 0) {
                        return [];
                    }
                    // If there is no search, and 1 object is selected we are on the object page.
                    // Export all children of the object and the object itself.
                    return (await getChildObjects(objectIds[0])).concat(objectIds);
                } else {
                    return objectIds;
                }
            }

            getObjectIds().then((Ids) => {
                // When exporting all, send search result if a vector search was used
                // otherwise send the query.
                store.objects.exportProperties({
                    objectIds: Ids,
                    type: exportType,
                    query: exportAll && !query.vector ? query : { type: query.type },
                }).then((response) => {
                    let data;

                    if (exportType === ExportTypes.CSV) {
                        data = new Blob([response.data], { type: response.type });
                    } else if (exportType === ExportTypes.JSON) {
                        data = new Blob([JSON.stringify(response.data)], { type: response.type });
                    } else {
                        const responseData: any = response.data
                        data = new Blob([new Uint8Array(responseData.data)], { type: response.type });
                    }

                    const url = window.URL.createObjectURL(data);
                    const a: any = document.createElement('a');
                    a.download = response.name;
                    a.href = url;
                    a.click();

                    toast({
                        status: 'success',
                        title: 'Export Properties',
                        description: exportAll ? 'Export the properties of all objects completed'
                            : `Export the properties of ${objectIds.length} object${objectIds.length > 1 ? 's' : ''} is completed`,
                        duration: 2000
                    });
                }).catch(err => {
                    toast({
                        status: 'error',
                        title: 'Error Export Properties',
                        description: err.message,
                        duration: 5000
                    });
                }).finally(() => {
                    setIsExporting(false);
                    setOpen(false);
                });
            });
        } else {
            setOpen(false);
        }
    }

    return (
        <ExportPropertiesModal isExporting={isExporting} isOpen={isOpen} onClose={onExportType} />
    )
}

export const ExportPropertiesAction: ObjectsActionSpec = {
    id: "exportProperties",
    name: 'Export Properties',
    description: 'Export all Object Properties',
    confirm: false,
    component: ExportPropertiesComponent,
}
