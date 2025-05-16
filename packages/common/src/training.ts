import type { TrainingJob } from "@llumiverse/core";
import { ExecutionEnvironmentRef } from "./environment.js";

export enum TrainingSessionStatus {
    'created' = 'created',
    'building' = 'building',
    'prepared' = 'prepared',
    'processing' = 'processing',
    'completed' = 'completed',
    'cancelled' = 'cancelled',
    'failed' = 'failed'
}

export interface TrainingSession {
    id: string;
    project: string;
    name: string
    env: ExecutionEnvironmentRef,
    model: string,
    status: TrainingSessionStatus,
    runs: string[],
    dataset: string, //the name of the file dataset which was generated in GCS
    job: TrainingJob,
    created_by: string,
    updated_by: string,
    created_at: Date,
    updated_at: Date,
}

export interface TrainingSessionRef extends Omit<TrainingSession, 'runs'> {
}


export interface TrainingSessionCreatePayload {
    name: string
    env: string,
    model: string,
}

export interface ListTrainingSessionsQuery {
    limit?: number;
    offset?: number;
    status?: TrainingSessionStatus;
}