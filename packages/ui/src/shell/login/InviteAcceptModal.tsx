import { TransientToken, UserInviteTokenData } from "@vertesia/common"
import { Button, VModal, VModalBody, VModalTitle } from "@vertesia/ui/core"
import { useEffect, useState } from "react"
import { useUserSession } from "@vertesia/ui/session"


export function InviteAcceptModal() {

    const session = useUserSession()
    const { client, account } = session;
    const [showModal, setShowModal] = useState(false)
    const [invites, setInvites] = useState<TransientToken<UserInviteTokenData>[]>([])

    useEffect(() => {
        client.account.listInvites().then(invites => {
            if (invites.length > 0) {
                // Filter out legacy invites that do not have account data
                const notLegacyInvites = invites.filter(i => i.data.account);
                if (notLegacyInvites.length === 0) {
                    console.log("No valid invites found, closing modal")
                    return;
                }
                // If we have valid invites, show the modal
                console.log("Found valid invites", notLegacyInvites.length)
                setShowModal(true);
                setInvites(notLegacyInvites);
            } else {
                console.log("No invites found, closing modal")
                setShowModal(false);
            }
        }).catch(err => {
            console.error("Error fetching invites", err);
        })
    }, [account?.id])

    const closeModal = () => setShowModal(false)

    const accept = async (invite: TransientToken<UserInviteTokenData>) => {
        await client.account.acceptInvite(invite.id);
        await session.fetchAccounts();
        const remainingInvites = invites.filter(i => i.id !== invite.id)

        const notLegacyInvites = remainingInvites.filter(i => i.data.account);
        if (notLegacyInvites.length > 0) {
            setInvites(notLegacyInvites);
        } else {
            closeModal();
        }
    }

    const reject = async (invite: TransientToken<UserInviteTokenData>) => {
        await client.account.rejectInvite(invite.id)
        const remainingInvites = invites.filter(i => i.id !== invite.id)
        setInvites(remainingInvites)
        if (remainingInvites.length === 0) {
            closeModal();
        }
    }

    const inviteList = invites.map(invite => {
        if (!invite.data.account) {
            console.warn("Invite has no account data", invite);
            return null; // Skip rendering this invite
        }

        return (<div key={invite.id} className="flex flex-row w-full justify-between border rounded-sm px-2 py-2 ">
            <div className="flex flex-col">
                <div className="w-full font-semibold">{invite.data.account.name ?? invite.data.account}</div>
                {invite.data.project && <div className="w-full text-base">- {invite.data.project.name}</div>}
                <div className="text-xs">Role: {invite.data.role}</div>
                <div className="text-xs">by {invite.data.invited_by.name}</div>
            </div>
            <div className="flex flex-col gap-4">
                <Button size={'xs'} onClick={() => accept(invite)}>Accept</Button> <Button size={'xs'} variant="secondary" onClick={() => reject(invite)}>Reject</Button>
            </div>
        </div>)
    })

    return (
        <div>
            <VModal isOpen={showModal} onClose={closeModal}>
                <VModalTitle>Review Invites</VModalTitle>
                <VModalBody>
                    <div className="text-sm pb-4">
                        You have received the following invites to join other accounts.
                        Please review and accept or declined them.
                    </div>
                    {inviteList}
                </VModalBody>
            </VModal>
        </div>
    )

}
