import type { z } from 'zod';
import type { ResourceRefSchema } from './api-schemas/zeno-remaining.js';

export enum ResolvableRefType {
    project = 'Project',
    projects = 'Projects',
    environment = 'Environment',
    user = 'User',
    account = 'Account',
    interaction = 'Interaction',
    userGroup = 'UserGroup',
}

export interface ResolvableRef {
    type: ResolvableRefType;
    id: string;
}

export interface RefResolutionRequest {
    refs: ResolvableRef[];
}

export type ResourceRef = z.infer<typeof ResourceRefSchema>;
