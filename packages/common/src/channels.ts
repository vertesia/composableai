import { EmailChannel, isEmailChannel, UserChannel } from "./interaction.js";

/**
 * Find the email channel from a list of channels.
 * @returns The email channel if found, undefined otherwise
 */
export function findEmailChannel(channels?: UserChannel[]): EmailChannel | undefined {
    return channels?.find(isEmailChannel);
}

/**
 * Check if email channel is enabled in the channels list.
 */
export function hasEmailChannel(channels?: UserChannel[]): boolean {
    return !!findEmailChannel(channels);
}

/**
 * Update the email channel in a channels array (immutable).
 * Returns a new array with the updated channel.
 * If no email channel exists and to_email is provided, creates one.
 */
export function updateEmailChannel(
    channels: UserChannel[] | undefined,
    updates: Partial<Omit<EmailChannel, "type">>
): UserChannel[] {
    const existing = channels || [];
    const emailIndex = existing.findIndex(isEmailChannel);

    if (emailIndex === -1) {
        // No email channel exists, create one if we have required fields
        if (updates.to_email) {
            return [...existing, { type: "email", ...updates } as EmailChannel];
        }
        return existing;
    }

    // Update existing email channel
    const updated = [...existing];
    updated[emailIndex] = {
        ...updated[emailIndex],
        ...updates,
        type: "email",
    } as EmailChannel;
    return updated;
}

/**
 * Update email threading info after sending or receiving an email.
 * Adds the new messageId to references and updates in_reply_to.
 */
export function updateEmailThreading(
    channels: UserChannel[] | undefined,
    messageId: string,
    subject?: string
): UserChannel[] {
    const emailChannel = findEmailChannel(channels);
    if (!emailChannel) return channels || [];

    const newReferences = emailChannel.references ? [...emailChannel.references] : [];
    if (!newReferences.includes(messageId)) {
        newReferences.push(messageId);
    }

    return updateEmailChannel(channels, {
        in_reply_to: messageId,
        references: newReferences,
        thread_subject: subject || emailChannel.thread_subject,
    });
}
