import { ReactNode } from "react";
import { useUITranslation } from "@vertesia/ui/i18n";
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
    const { t } = useUITranslation();
    const toast = useToast();

    const doDelete = async () => {

        if (!idToDelete) {
            return;
        }
        return deleteApi(idToDelete)
            .then(() => {
                toast({
                    title: t('modal.delete.succeeded'),
                    status: 'success'
                });
            }).catch((err: any) => {
                toast({
                    title: t('modal.delete.failed'),
                    description: err.message ?? t('modal.delete.error'),
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
