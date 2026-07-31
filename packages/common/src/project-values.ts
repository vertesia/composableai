// Project values that exist at runtime — currently the system role catalog.
//
// Split out of `project.ts` for the reason `account-values.ts` was split out of `user.ts`: the API
// schemas need `SystemRoles` at runtime (`z.enum(SystemRoles)`), and `project.ts` needs the types
// those schemas infer. Re-exported from `project.ts`, so this is a move, not a rename.
//
// `//` rather than JSDoc, and not a style preference: `SystemRoles` is the first declaration in the
// file, and zeno-server's scanner attaches a leading DOC comment to the declaration that follows it.
// Written as JSDoc, this note became the published `SystemRoles.description` in the OpenAPI
// document — internal migration commentary shipped to every generated client. The sibling
// `access-control-values.ts` keeps its JSDoc header only because none of its enums are resolved
// through that path.

export enum SystemRoles {
    owner = 'owner', // all permissions
    admin = 'admin', // all permissions
    manager = 'manager', // all permissions but manage_account, manage_billing
    developer = 'developer', // all permissions but manage_account, manage_billing, manage_roles, delete
    application = 'application', // executor + request_pk
    automation = 'automation', // event-triggered automation runner
    content_processor = 'content_processor', // trusted system content processing
    consumer = 'consumer', // required permissions for users of micro apps
    executor = 'executor', // can only read and execute interactions
    reader = 'reader', // can only read (browse)
    auditor = 'auditor', // can read all non-admin resources without mutation permissions
    support = 'support', // Vertesia support read-only role
    billing = 'billing', // can only manage billings
    member = 'member', // can only access, but no specific permissions
    app_member = 'app_member', // used to mark an user have access to an application. does not provide any permission on its own
    content_superadmin = 'content_superadmin', // can see all content objects and collections
}
