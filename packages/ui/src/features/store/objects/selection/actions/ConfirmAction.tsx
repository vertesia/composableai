import { ConfirmModal } from "@vertesia/ui/core";
import { useCallback, useState } from "react";
import { useUITranslation } from '../../../../../i18n/index.js';
import { ObjectsActionCallback, useObjectsActionCallback } from '../ObjectsActionHooks';
import { ObjectsActionParams, ObjectsActionSpec } from "../ObjectsActionSpec";

interface ObjectsActionComponentProps {
    action: ObjectsActionSpec,
    callback: ObjectsActionCallback,
    children?: React.ReactNode;
}
/**
 * Generic implementation of an action component.
 * The action component is not the one which is clicked by the user, but the one that is registering the action callback.
 * @param param0
 * @returns
 */
export default function ConfirmAction({ action, callback, children }: ObjectsActionComponentProps) {
    const { t } = useUITranslation();
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const confirmationText = action.confirmationText || `Are you sure you want to ${action.name}?`;

    const _callback = useCallback((params: ObjectsActionParams) => {
        if (action.confirm) {
            setShowConfirmModal(true);
            return Promise.resolve(true);
        } else {
            return callback(params);
        }
    }, [action.confirm, callback]);

    const ctx = useObjectsActionCallback(action.id, _callback);

    const onConfirm = () => {
        setShowConfirmModal(false);
        callback({ ...ctx.params, action });
    };

    return (
        <>
            {children}
            <ConfirmModal onConfirm={onConfirm} onCancel={() => setShowConfirmModal(false)} title={t('store.actions.areYouSure')} content={confirmationText} isOpen={showConfirmModal} />
        </>
    );


}