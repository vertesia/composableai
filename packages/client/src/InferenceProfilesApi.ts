import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateInferenceProfilePayload,
    DeleteByIdResult,
    InferenceProfile,
    InferenceProfileRecord,
    ProjectConfiguration,
    ProjectInferenceProfiles,
    UpdateInferenceProfilePayload,
} from '@vertesia/common';

export default class InferenceProfilesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/inference-profiles');
    }
    /** Read a category or base default, including projects awaiting the defaults migration. */
    async getDefault(
        configuration: Pick<ProjectConfiguration, 'inference' | 'defaults'>,
        category?: keyof NonNullable<ProjectInferenceProfiles['system']>,
    ): Promise<InferenceProfile | undefined> {
        const settings = configuration.inference;
        const id = (category ? settings?.system?.[category] : undefined) ?? settings?.default_profile;
        if (id) return this.retrieve(id);
        return (category ? configuration.defaults?.system?.[category] : undefined) ?? configuration.defaults?.base;
    }

    list(): Promise<InferenceProfileRecord[]> {
        return this.get('/');
    }
    retrieve(id: string): Promise<InferenceProfileRecord> {
        return this.get(`/${encodeURIComponent(id)}`);
    }
    create(payload: CreateInferenceProfilePayload): Promise<InferenceProfileRecord> {
        return this.post('/', { payload });
    }
    update(id: string, payload: UpdateInferenceProfilePayload): Promise<InferenceProfileRecord> {
        return this.put(`/${encodeURIComponent(id)}`, { payload });
    }
    delete(id: string): Promise<DeleteByIdResult> {
        return this.del(`/${encodeURIComponent(id)}`);
    }
}
