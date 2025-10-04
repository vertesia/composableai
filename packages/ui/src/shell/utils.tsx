export function isVertesiaEmail(email: string | undefined) {
    return email ? (
        email.endsWith('@vertesiahq.com') ||
        email.endsWith('@becomposable.com') ||
        email.endsWith('@composableprompts.com')
    ) : false;
}
