/**
 * @deprecated Do not use to decide whether someone is a Vertesia employee. It reads the user's
 * stored email address, which an account administrator can change (for example through SCIM), so it
 * proves nothing about who signed in. Decide on the server, from the signed token, instead. This
 * export is kept only so existing plugin bundles keep loading, and will be removed in a future
 * major version.
 */
export function isVertesiaEmail(email: string | undefined) {
    return email
        ? email.endsWith('@vertesiahq.com') ||
              email.endsWith('@becomposable.com') ||
              email.endsWith('@composableprompts.com')
        : false;
}
