import { useEffect } from 'react';
import { useObjectsActionContext } from './ObjectsActionContext';
import { AddToCollectionActionComponent } from './actions/AddToCollectionAction';
import { ChangeTypeActionComponent } from './actions/ChangeTypeAction';
import { DeleteObjectsActionComponent } from './actions/DeleteObjectsAction';
import { ExportPropertiesComponent } from './actions/ExportPropertiesAction';
import { RemoveFromCollectionActionComponent } from './actions/RemoveFromCollectionAction';
import { StartWorkflowComponent } from './actions/StartWorkflowComponent';

export function ActionsRenderer() {
    const context = useObjectsActionContext();

    // Set the components on the actions
    useEffect(() => {
        const componentMap: Record<string, any> = {
            'exportProperties': ExportPropertiesComponent,
            'changeType': ChangeTypeActionComponent,
            'startWorkflow': StartWorkflowComponent,
            'addToCollection': AddToCollectionActionComponent,
            'delete': DeleteObjectsActionComponent,
            'removeFromCollection': RemoveFromCollectionActionComponent,
        };

        context.allActions?.forEach(action => {
            if (componentMap[action.id]) {
                action.component = componentMap[action.id];
            }
        });

        // Also set components for workflow rules
        context.wfRules?.forEach(rule => {
            if (rule.isWorkflow) {
                rule.component = StartWorkflowComponent;
            }
        });
    }, [context]);

    const selection = context.params.selection;
    const objectId = selection.getObjectId();
    const objectIds = selection.isSingleSelection() && objectId ? [objectId] : selection.getObjectIds();

    return (
        <div style={{ display: 'none' }}>
            {
                context.allActions?.map(action => (
                    action.component ? <action.component key={action.id} action={action} objectIds={objectIds} collectionId={selection.collectionId} /> : null
                ))
            }
            {
                context.wfRules?.map(rule => (
                    rule.component ? <rule.component key={rule.id} action={rule} objectIds={objectIds} collectionId={selection.collectionId} /> : null
                ))
            }
        </div>
    )
}