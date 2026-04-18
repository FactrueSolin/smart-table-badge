import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { FileImageGenerationRepository } from '@/lib/ai/image-generation/repository';
import type { ImageGenerationJobRecord } from '@/lib/ai/image-generation/types';

function buildJob(overrides: Partial<ImageGenerationJobRecord> = {}): ImageGenerationJobRecord {
  return {
    id: 'job_test',
    provider: 'modelscope',
    mode: 'text_to_image',
    status: 'submitted',
    name: '春季海报',
    prompt: 'prompt',
    negativePrompt: null,
    model: 'Qwen/Qwen-Image',
    size: '1024x1024',
    seed: null,
    steps: 20,
    guidance: 3.5,
    remoteTaskId: 'task_123',
    remoteRequestId: null,
    statusReason: null,
    errorMessage: null,
    syncAttempts: 0,
    lastSyncedAt: null,
    nextSyncAt: '2026-04-20T00:00:00.000Z',
    submittedAt: '2026-04-19T00:00:00.000Z',
    processingStartedAt: null,
    completedAt: null,
    idempotencyKey: 'idem-1',
    requestFingerprint: 'fingerprint',
    providerRequestPayload: null,
    providerResponsePayload: null,
    outputs: [],
    events: [],
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileImageGenerationRepository', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('能够落盘读取任务并通过幂等键查询', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'htmlpush-ai-job-repo-'));
    process.chdir(tempDir);

    const repository = new FileImageGenerationRepository();
    await repository.createJob(buildJob());

    const loaded = await repository.getJob('job_test');
    const byIdempotency = await repository.getJobByIdempotencyKey('idem-1');

    expect(loaded?.id).toBe('job_test');
    expect(byIdempotency?.id).toBe('job_test');
  });

  it('能够筛选到期任务', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'htmlpush-ai-job-repo-'));
    process.chdir(tempDir);

    const repository = new FileImageGenerationRepository();
    await repository.createJob(buildJob({ id: 'job_due', nextSyncAt: '2026-04-19T00:00:00.000Z' }));
    await repository.createJob(buildJob({ id: 'job_future', nextSyncAt: '2026-04-20T00:00:00.000Z' }));

    const dueJobs = await repository.listDueJobs(new Date('2026-04-19T12:00:00.000Z'), 10);

    expect(dueJobs.map((job) => job.id)).toEqual(['job_due']);
  });
});
