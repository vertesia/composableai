import { TrainingJob } from "@llumiverse/core";
import { ExecutionRunRef, ListTrainingSessionsQuery, TrainingSession, TrainingSessionCreatePayload, TrainingSessionRef } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";


export default class TrainingApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/training")
    }

    listSessions(query: ListTrainingSessionsQuery = {}): Promise<TrainingSessionRef[]> {
        return this.get('/', { query: query as any });
    }

    listSessionNames(query: ListTrainingSessionsQuery = {}): Promise<{ id: string, name: string }[]> {
        return this.get('/names', { query: query as any });
    }

    createSession(payload: TrainingSessionCreatePayload): Promise<TrainingSession> {
        return this.post('/', { payload })
    }

    getSession(sessionId: string): Promise<TrainingSession> {
        return this.get('/' + sessionId)
    }

    addToSession(sessionId: string, runs: string[]): Promise<any> {
        return this.post('/' + sessionId + '/add', { payload: { runs } })
    }

    listSessionRuns(sessionId: string, limit = 100, offset = 0): Promise<ExecutionRunRef[]> {
        return this.get('/' + sessionId + '/runs', { query: { limit, offset } });
    }

    buildSession(sessionId: string) {
        return this.post('/' + sessionId + '/build');
    }

    getDataUrl(sessionId: string): Promise<{ url: string }> {
        return this.get('/' + sessionId + '/url')
    }

    getDataUploadUrl(sessionId: string, isResumable = false): Promise<{ url: string }> {
        return this.get('/' + sessionId + '/upload-url',
            isResumable ? { query: { resumable: 'true' } } : {})
    }

    startTraining(sessionId: string): Promise<TrainingJob> {
        return this.post('/' + sessionId + '/start');
    }

    cancelTraining(sessionId: string): Promise<TrainingJob> {
        return this.post('/' + sessionId + '/cancel');
    }

    getTrainingJob(jobId: string): Promise<TrainingJob> {
        return this.get(`/job/${jobId}`);
    }

    getAndSyncTrainingJob(jobId: string): Promise<TrainingJob> {
        return this.get(`/job/${jobId}`, {
            query: { sync: 'true' }
        });
    }

    setDataset(sessionId: string, name: string = "default"): Promise<any> {
        return this.post('/' + sessionId + '/dataset', { payload: { dataset: name } })
    }

}