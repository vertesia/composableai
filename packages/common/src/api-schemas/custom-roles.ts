import { z } from 'zod';
import { CUSTOM_ROLE_NAME_MAX_LENGTH, CUSTOM_ROLE_NAME_PATTERN } from '../custom-role-values.js';
import { PermissionSchema } from './access-control.js';
import { AssignableRoleNameSchema } from './apikey.js';

export const CustomRoleDefinitionSchema = z
    .object({
        name: z.string().max(CUSTOM_ROLE_NAME_MAX_LENGTH).regex(CUSTOM_ROLE_NAME_PATTERN).meta({
            description: 'Immutable snake_case name without the c: prefix. References in ACEs and tokens use c:<name>.',
        }),
        title: z.string().trim().min(1).max(120),
        description: z.string().max(1000).optional(),
        base_roles: z.array(AssignableRoleNameSchema).optional().meta({
            description:
                'Roles whose permissions are inherited, in addition to permissions below. Use built-in system role names or c:<name> references in this account. Cycles and ABAC roles are not allowed. Changes to a base role apply to newly minted tokens.',
        }),
        permissions: z.array(PermissionSchema).max(Object.keys(PermissionSchema.enum).length),
    })
    .meta({ id: 'CustomRoleDefinition' });

export const CustomRoleDefinitionArraySchema = z
    .array(CustomRoleDefinitionSchema)
    .meta({ id: 'CustomRoleDefinitionArray' });
export const CreateCustomRolePayloadSchema = CustomRoleDefinitionSchema.meta({ id: 'CreateCustomRolePayload' });
export const UpdateCustomRolePayloadSchema = CustomRoleDefinitionSchema.omit({ name: true })
    .partial()
    .meta({ id: 'UpdateCustomRolePayload' });
export const PermissionArraySchema = z.array(PermissionSchema).meta({ id: 'PermissionArray' });
