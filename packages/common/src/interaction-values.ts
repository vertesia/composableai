// Interaction values that exist at runtime and are read by the API schemas.
//
// Split out of `interaction.ts` for the reason `project-values.ts` was split out of `project.ts`:
// `InteractionExecutionConfigurationSchema` is `z.enum(...)` over these two, and importing
// `interaction.ts` from a schema module at runtime would both be a cycle risk and pull the largest
// module in the package into every schema consumer. Re-exported from `interaction.ts`, so this is a
// move, not a rename.
//
// `//` rather than JSDoc, and not a style preference: the first declaration in the file would
// otherwise inherit this note as its published component `description`, the way `project-values.ts`
// records.

export enum RunDataStorageLevel {
    STANDARD = 'STANDARD',
    RESTRICTED = 'RESTRICTED',
    DEBUG = 'DEBUG',
}

export enum ConfigModes {
    RUN_AND_INTERACTION_CONFIG = 'RUN_AND_INTERACTION_CONFIG',
    RUN_CONFIG_ONLY = 'RUN_CONFIG_ONLY',
    INTERACTION_CONFIG_ONLY = 'INTERACTION_CONFIG_ONLY',
}
