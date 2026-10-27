import type { TestWorkflowEnvironment } from '@temporalio/testing';

export function retryableDownloadFailure(error: unknown): string | undefined;
export function withTemporalDownloadRetry<T>(create: () => Promise<T>, retries?: number): Promise<T>;
export function createLocalTestEnvironment(): Promise<TestWorkflowEnvironment>;
export function createTimeSkippingTestEnvironment(): Promise<TestWorkflowEnvironment>;
