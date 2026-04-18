import type { ImageGenerationJobRecord, ImageGenerationJobStatus } from '@/lib/ai/image-generation/types';

const TERMINAL_STATUSES = new Set<ImageGenerationJobStatus>([
  'succeeded',
  'failed',
  'timed_out',
  'canceled',
  'import_failed',
]);

export function isTerminalJobStatus(status: ImageGenerationJobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function shouldSyncJob(job: ImageGenerationJobRecord, now = new Date()): boolean {
  if (isTerminalJobStatus(job.status) || !job.remoteTaskId || !job.nextSyncAt) {
    return false;
  }

  return new Date(job.nextSyncAt).getTime() <= now.getTime();
}

export function getScheduledNextSync(pollIntervalMs: number, now = new Date()): string {
  return new Date(now.getTime() + pollIntervalMs).toISOString();
}

export function getTimedOutStatus(job: ImageGenerationJobRecord, timeoutSeconds: number, now = new Date()): boolean {
  const startedAt = job.submittedAt || job.createdAt;
  return new Date(startedAt).getTime() + timeoutSeconds * 1000 <= now.getTime();
}
