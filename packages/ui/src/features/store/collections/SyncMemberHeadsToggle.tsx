import { Collection } from "@vertesia/common";
import { Panel, Switch, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useState } from "react";

interface SyncMemberHeadsToggleProps {
    collection: Collection;
}
export function SyncMemberHeadsToggle({ collection }: SyncMemberHeadsToggleProps) {

    const { client } = useUserSession();
    const [skipHeadSync, setSkipHeadSync] = useState<boolean>(collection.skip_head_sync ?? false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const toast = useToast();

    const onSaveSkipHeadSync = (enableSyncHeads: boolean) => {
        const skip_head_sync = !enableSyncHeads;
        setIsSaving(true);
        client.store.collections.update(collection.id, {
            skip_head_sync: skip_head_sync
        }).then(() => {
            // Handle success
            toast({
                title: "Updated skip head sync setting",
                status: "success"
            })
            setSkipHeadSync(skip_head_sync);
        }).catch((error) => {
            toast({
                title: "Failed to update skip head sync",
                description: error.message,
                status: "error"
            })
            // Handle error
        }).finally(() => {
            setIsSaving(false);
        });
    }

    return (
        <Panel title="Synchronize Member Heads" description="When a new HEAD version of a member is created the colleciton will be updated to point to the new HEAD.">
            <Switch disabled={isSaving} value={!skipHeadSync} onChange={onSaveSkipHeadSync}>
                Enable synchronizing member heads
            </Switch>
        </Panel>
    )

}
