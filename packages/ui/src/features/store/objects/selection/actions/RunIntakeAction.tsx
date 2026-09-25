import { errorMessage, useToast } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback } from 'react';
import { useDocumentSearch } from '../../search';
import { useObjectsActionContext } from '../ObjectsActionHooks';
import type { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';
import ConfirmAction from './ConfirmAction';

/**
 * Re-runs the unified standard intake pipeline over the selected objects. The server resolves each
 * object's nature and starts one run per object — see the `start_workflow` bulk operation.
 */
export function RunIntakeActionComponent({ action, objectIds }: ActionComponentTypeProps) {
    const { t } = useUITranslation();
    const ctx = useObjectsActionContext();
    const toast = useToast();
    const { store } = useUserSession();
    const search = useDocumentSearch();

    const callback = useCallback(() => {
        if (!objectIds?.length) {
            toast({
                status: 'error',
                title: t('store.actions.noObjectsSelected'),
                description: t('store.actions.pleaseSelectObjectsToRunIntake'),
                duration: 3000,
            });
            return Promise.resolve(false);
        }

        return store
            .runOperation({ name: 'start_workflow', ids: objectIds, params: {} })
            .then(() => {
                toast({
                    status: 'success',
                    title: t('store.actions.intakeStarted'),
                    description: t('store.actions.intakeStartedOn', { count: objectIds.length }),
                    duration: 3000,
                });
                // Intake rewrites status, type and properties asynchronously, so refresh the list
                // to pick up the `processing` status rather than leaving stale rows selected.
                if (search) {
                    ctx.params?.selection?.removeAll();
                    search.search();
                }
            })
            .catch((err: unknown) => {
                toast({
                    status: 'error',
                    title: t('store.actions.errorStartingIntake'),
                    description: errorMessage(err),
                    duration: 5000,
                });
            });
    }, [ctx.params?.selection?.removeAll, objectIds, search, search?.search, store.runOperation, t, toast]);

    return <ConfirmAction action={action} callback={callback} />;
}

const t_static = i18nInstance.getFixedT(null, NAMESPACE);
export const RunIntakeAction: ObjectsActionSpec = {
    id: 'runIntake',
    name: t_static('store.actions.runIntake'),
    description: t_static('store.actions.runIntakeDesc'),
    confirm: true,
    confirmationText: t_static('store.actions.confirmRunIntake'),
    component: RunIntakeActionComponent,
};
