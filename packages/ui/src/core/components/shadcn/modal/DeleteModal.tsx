import { ReactNode } from "react";
import { ConfirmModal } from "./ConfirmModal.js";
import { useToast } from "../../toast/index.js";

interface DeleteModalProps {
    idToDelete?: string;
    title: string;
    content: string | ReactNode;
    setIdToDelete: (id: string | undefined) => void;
    deleteApi: (id: string) => Promise<any>;
}
export function DeleteModal({ idToDelete, title, content, setIdToDelete, deleteApi }: DeleteModalProps) {
    const toast = useToast();

    const doDelete = async () => {

        if (!idToDelete) {
            return;
        }
        return deleteApi(idToDelete)
            .then(() => {
                toast({
                    title: 'Delete succeeded',
                    status: 'success'
                });
            }).catch((err: any) => {
                toast({
                    title: 'Failed to delete',
                    description: err.message ?? 'An error occurred while deleting the object',
                    status: 'error'
                });
            }).finally(() => {
                setIdToDelete(undefined);
            });
    };

    return (
        <ConfirmModal
            title={title}
            content={content}
            isOpen={!!idToDelete}
            onConfirm={doDelete}
            onCancel={() => { setIdToDelete(undefined); }} />
    );
}
