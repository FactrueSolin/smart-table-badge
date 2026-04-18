import { createHash, randomBytes } from 'node:crypto';

import { broadcast } from '@/lib/sse';
import { AiImageError } from '@/lib/ai/image-generation/errors';
import { imageGenerationImporter } from '@/lib/ai/image-generation/importer';
import type { ImageGenerationImporter } from '@/lib/ai/image-generation/importer';
import {
  getImageGenerationSettings,
  normalizeCreateInput,
  validateCreateInputAgainstModel,
} from '@/lib/ai/image-generation/model-config';
import { createImageGenerationProvider } from '@/lib/ai/image-generation/providers/provider-factory';
import type { ImageGenerationProvider } from '@/lib/ai/image-generation/providers/types';
import { imageGenerationRepository } from '@/lib/ai/image-generation/repository';
import type { ImageGenerationRepository } from '@/lib/ai/image-generation/repository';
import {
  getScheduledNextSync,
  getTimedOutStatus,
  isTerminalJobStatus,
  shouldSyncJob,
} from '@/lib/ai/image-generation/state-machine';
import type {
  ImageGenerationCreateInput,
  ImageGenerationJobDetail,
  ImageGenerationJobEvent,
  ImageGenerationJobOutput,
  ImageGenerationJobRecord,
  ImageGenerationJobStatus,
  ImageGenerationJobSummary,
  ImageGenerationListQuery,
  ImageGenerationListResult,
  ImageGenerationProviderName,
  ImageGenerationSyncDueResult,
} from '@/lib/ai/image-generation/types';

function nowIso(date = new Date()): string {
  return date.toISOString();
}

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function createEntityId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;
}

function createEvent(
  type: ImageGenerationJobEvent['type'],
  status: ImageGenerationJobStatus,
  message: string | null,
  reason: string | null,
  createdAt = nowIso(),
): ImageGenerationJobEvent {
  return {
    id: createEntityId('jevt'),
    type,
    status,
    message,
    reason,
    createdAt,
  };
}

function createRequestFingerprint(input: ImageGenerationCreateInput): string {
  return hashString(
    JSON.stringify({
      name: input.name,
      mode: input.mode,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt ?? null,
      model: input.model,
      size: input.size ?? null,
      seed: input.seed ?? null,
      steps: input.steps ?? null,
      guidance: input.guidance ?? null,
    }),
  );
}

function createOutput(remoteUrl: string, outputIndex: number, createdAt: string): ImageGenerationJobOutput {
  return {
    id: createEntityId('jout'),
    outputIndex,
    remoteUrl,
    remoteUrlHash: hashString(remoteUrl),
    status: 'pending_import',
    imageAssetId: null,
    pageId: null,
    imageUrl: null,
    pageUrl: null,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function summarizeJob(job: ImageGenerationJobRecord): ImageGenerationJobSummary {
  return {
    id: job.id,
    provider: job.provider,
    mode: job.mode,
    status: job.status,
    name: job.name,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    model: job.model,
    size: job.size,
    seed: job.seed,
    steps: job.steps,
    guidance: job.guidance,
    remoteTaskId: job.remoteTaskId,
    statusReason: job.statusReason,
    errorMessage: job.errorMessage,
    outputs: job.outputs,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    submittedAt: job.submittedAt,
    completedAt: job.completedAt,
  };
}

function detailJob(job: ImageGenerationJobRecord): ImageGenerationJobDetail {
  return {
    ...summarizeJob(job),
    remoteRequestId: job.remoteRequestId,
    syncAttempts: job.syncAttempts,
    lastSyncedAt: job.lastSyncedAt,
    nextSyncAt: job.nextSyncAt,
    processingStartedAt: job.processingStartedAt,
    events: job.events,
  };
}

function buildCursor(job: ImageGenerationJobRecord): string {
  return Buffer.from(JSON.stringify({ id: job.id, createdAt: job.createdAt })).toString('base64url');
}

function parseCursor(cursor: string): { id: string; createdAt: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as { id?: unknown; createdAt?: unknown };

    if (typeof parsed.id === 'string' && typeof parsed.createdAt === 'string') {
      return { id: parsed.id, createdAt: parsed.createdAt };
    }

    return null;
  } catch {
    return null;
  }
}

function sanitizeMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface ImageGenerationServiceDeps {
  repository?: ImageGenerationRepository;
  importer?: ImageGenerationImporter;
  createProvider?: (provider: ImageGenerationProviderName) => ImageGenerationProvider;
}

export class ImageGenerationService {
  private readonly repository: ImageGenerationRepository;
  private readonly importer: ImageGenerationImporter;
  private readonly createProvider: (provider: ImageGenerationProviderName) => ImageGenerationProvider;

  constructor(deps: ImageGenerationServiceDeps = {}) {
    this.repository = deps.repository ?? imageGenerationRepository;
    this.importer = deps.importer ?? imageGenerationImporter;
    this.createProvider = deps.createProvider ?? createImageGenerationProvider;
  }

  private broadcastJob(job: ImageGenerationJobRecord, event: ImageGenerationJobEvent['type']): void {
    broadcast('ai-image-job-changed', {
      jobId: job.id,
      status: job.status,
      event,
      timestamp: Date.now(),
      imageAssetIds: job.outputs
        .map((output) => output.imageAssetId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
      pageIds: job.outputs.map((output) => output.pageId).filter((value): value is string => typeof value === 'string' && value.length > 0),
    });
  }

  private broadcastImportedAssets(job: ImageGenerationJobRecord): void {
    const importedOutputs = job.outputs.filter((output) => output.imageAssetId && output.pageId);

    for (const output of importedOutputs) {
      broadcast('content-changed', {
        action: 'upload',
        type: 'image',
        id: output.imageAssetId,
        pageId: output.pageId,
        timestamp: Date.now(),
      });
    }
  }

  private async getJobRecordOrThrow(jobId: string): Promise<ImageGenerationJobRecord> {
    const job = await this.repository.getJob(jobId);

    if (!job) {
      throw new AiImageError('AI_IMAGE_JOB_NOT_FOUND', '任务不存在', 404, false);
    }

    return job;
  }

  async createJob(input: ImageGenerationCreateInput, options?: { idempotencyKey?: string | null }): Promise<ImageGenerationJobDetail> {
    const settings = getImageGenerationSettings();
    const normalizedInput = normalizeCreateInput(input, settings);
    validateCreateInputAgainstModel(normalizedInput, settings);

    const requestFingerprint = createRequestFingerprint(normalizedInput);
    const idempotencyKey = options?.idempotencyKey?.trim() || null;

    if (idempotencyKey) {
      const existingJob = await this.repository.getJobByIdempotencyKey(idempotencyKey);

      if (existingJob) {
        if (existingJob.requestFingerprint !== requestFingerprint) {
          throw new AiImageError('AI_IMAGE_IDEMPOTENCY_CONFLICT', '幂等键已绑定到不同请求', 409, false);
        }

        return detailJob(existingJob);
      }
    }

    const createdAt = nowIso();
    let job: ImageGenerationJobRecord = {
      id: createEntityId('job'),
      provider: settings.provider,
      mode: normalizedInput.mode,
      status: 'queued',
      name: normalizedInput.name,
      prompt: normalizedInput.prompt,
      negativePrompt: normalizedInput.negativePrompt ?? null,
      model: normalizedInput.model,
      size: normalizedInput.size ?? null,
      seed: normalizedInput.seed ?? null,
      steps: normalizedInput.steps ?? null,
      guidance: normalizedInput.guidance ?? null,
      remoteTaskId: null,
      remoteRequestId: null,
      statusReason: null,
      errorMessage: null,
      syncAttempts: 0,
      lastSyncedAt: null,
      nextSyncAt: null,
      submittedAt: null,
      processingStartedAt: null,
      completedAt: null,
      idempotencyKey,
      requestFingerprint,
      providerRequestPayload: {
        model: normalizedInput.model,
        prompt: normalizedInput.prompt,
        negativePrompt: normalizedInput.negativePrompt ?? null,
        size: normalizedInput.size ?? null,
        seed: normalizedInput.seed ?? null,
        steps: normalizedInput.steps ?? null,
        guidance: normalizedInput.guidance ?? null,
      },
      providerResponsePayload: null,
      outputs: [],
      events: [createEvent('job_created', 'queued', null, null, createdAt)],
      createdAt,
      updatedAt: createdAt,
    };

    await this.repository.createJob(job);

    try {
      const provider = this.createProvider(job.provider);
      const submitted = await provider.submit({
        model: job.model,
        prompt: job.prompt,
        negativePrompt: job.negativePrompt ?? undefined,
        size: job.size ?? undefined,
        seed: job.seed ?? undefined,
        steps: job.steps ?? undefined,
        guidance: job.guidance ?? undefined,
      });

      const submittedAt = nowIso();
      job = {
        ...job,
        status: 'submitted',
        remoteTaskId: submitted.taskId,
        remoteRequestId: submitted.requestId ?? null,
        nextSyncAt: getScheduledNextSync(settings.pollIntervalMs, new Date(submittedAt)),
        submittedAt,
        providerResponsePayload: submitted.raw ?? null,
        updatedAt: submittedAt,
        events: [...job.events, createEvent('job_submitted', 'submitted', null, null, submittedAt)],
      };

      await this.repository.saveJob(job);
      this.broadcastJob(job, 'job_submitted');

      return detailJob(job);
    } catch (error) {
      const failedAt = nowIso();
      job = {
        ...job,
        status: 'failed',
        statusReason: 'provider_submit_failed',
        errorMessage: sanitizeMessage(error, 'Provider 提交失败'),
        nextSyncAt: null,
        completedAt: failedAt,
        updatedAt: failedAt,
        events: [
          ...job.events,
          createEvent('job_failed', 'failed', sanitizeMessage(error, 'Provider 提交失败'), 'provider_submit_failed', failedAt),
        ],
      };

      await this.repository.saveJob(job);
      this.broadcastJob(job, 'job_failed');

      if (error instanceof AiImageError) {
        throw error;
      }

      throw new AiImageError('AI_IMAGE_PROVIDER_SUBMIT_FAILED', '生图任务提交失败', 502, true);
    }
  }

  async listJobs(query: ImageGenerationListQuery): Promise<ImageGenerationListResult> {
    const jobs = await this.repository.listJobs({
      status: query.status,
      provider: query.provider,
      model: query.model,
    });

    const parsedCursor = query.cursor ? parseCursor(query.cursor) : null;
    const filtered = parsedCursor
      ? jobs.filter((job) => {
          if (job.createdAt < parsedCursor.createdAt) {
            return true;
          }

          if (job.createdAt === parsedCursor.createdAt && job.id < parsedCursor.id) {
            return true;
          }

          return false;
        })
      : jobs;

    const items = filtered.slice(0, query.limit);
    const nextCursor = filtered.length > query.limit ? buildCursor(filtered[query.limit - 1]) : null;

    return {
      items: items.map((job) => summarizeJob(job)),
      nextCursor,
    };
  }

  async getJob(jobId: string, options?: { sync?: boolean }): Promise<ImageGenerationJobDetail> {
    const job = await this.getJobRecordOrThrow(jobId);

    if (options?.sync === false) {
      return detailJob(job);
    }

    if (!shouldSyncJob(job)) {
      return detailJob(job);
    }

    return this.syncJob(jobId);
  }

  async syncJob(jobId: string): Promise<ImageGenerationJobDetail> {
    const settings = getImageGenerationSettings();
    let job = await this.getJobRecordOrThrow(jobId);

    if (isTerminalJobStatus(job.status) || !job.remoteTaskId) {
      return detailJob(job);
    }

    const syncedAt = nowIso();

    if (getTimedOutStatus(job, settings.timeoutSeconds, new Date(syncedAt))) {
      job = {
        ...job,
        status: 'timed_out',
        statusReason: 'provider_timeout',
        errorMessage: '生图任务超时',
        lastSyncedAt: syncedAt,
        nextSyncAt: null,
        completedAt: syncedAt,
        updatedAt: syncedAt,
        syncAttempts: job.syncAttempts + 1,
        events: [...job.events, createEvent('job_timed_out', 'timed_out', '生图任务超时', 'provider_timeout', syncedAt)],
      };

      await this.repository.saveJob(job);
      this.broadcastJob(job, 'job_timed_out');
      return detailJob(job);
    }

    try {
      const provider = this.createProvider(job.provider);
      const snapshot = await provider.getTask(job.remoteTaskId);
      const nextSyncAt = snapshot.status === 'succeeded' || snapshot.status === 'failed'
        ? null
        : getScheduledNextSync(settings.pollIntervalMs, new Date(syncedAt));

      let nextStatus: ImageGenerationJobStatus =
        snapshot.status === 'running' ? 'processing' : snapshot.status === 'failed' ? 'failed' : job.status;

      if (snapshot.status === 'succeeded') {
        nextStatus = 'succeeded';
      } else if (snapshot.status === 'pending' && job.status === 'queued') {
        nextStatus = 'submitted';
      } else if (snapshot.status === 'pending' && job.status === 'submitted') {
        nextStatus = 'submitted';
      }

      const mergedOutputs = snapshot.outputImages.map((remoteUrl, index) => {
        const existing = job.outputs.find((output) => output.outputIndex === index);
        return existing ?? createOutput(remoteUrl, index, syncedAt);
      });

      job = {
        ...job,
        status: nextStatus,
        lastSyncedAt: syncedAt,
        nextSyncAt,
        syncAttempts: job.syncAttempts + 1,
        remoteRequestId: snapshot.requestId ?? job.remoteRequestId,
        providerResponsePayload: snapshot.raw ?? null,
        updatedAt: syncedAt,
        processingStartedAt:
          nextStatus === 'processing' ? job.processingStartedAt ?? syncedAt : job.processingStartedAt,
        outputs: mergedOutputs,
      };

      if (snapshot.status === 'pending' || snapshot.status === 'running') {
        const eventType = snapshot.status === 'running' ? 'job_processing' : 'job_polled';
        job = {
          ...job,
          events: [...job.events, createEvent(eventType, job.status, null, null, syncedAt)],
        };

        await this.repository.saveJob(job);

        if (snapshot.status === 'running') {
          this.broadcastJob(job, 'job_processing');
        }

        return detailJob(job);
      }

      if (snapshot.status === 'failed') {
        job = {
          ...job,
          status: 'failed',
          statusReason: 'provider_failed',
          errorMessage: snapshot.errorMessage || 'Provider 返回失败',
          completedAt: syncedAt,
          events: [
            ...job.events,
            createEvent('job_failed', 'failed', snapshot.errorMessage || 'Provider 返回失败', 'provider_failed', syncedAt),
          ],
        };

        await this.repository.saveJob(job);
        this.broadcastJob(job, 'job_failed');
        return detailJob(job);
      }

      const importedOutputs: ImageGenerationJobOutput[] = [];

      for (const output of job.outputs) {
        if (output.status === 'imported') {
          importedOutputs.push(output);
          continue;
        }

        try {
          const imported = await this.importer.importOutput(job, output);
          importedOutputs.push({
            ...output,
            status: 'imported',
            imageAssetId: imported.imageAssetId,
            pageId: imported.pageId,
            imageUrl: imported.imageUrl,
            pageUrl: imported.pageUrl,
            errorMessage: null,
            updatedAt: nowIso(),
          });
        } catch (error) {
          importedOutputs.push({
            ...output,
            status: 'import_failed',
            errorMessage: sanitizeMessage(error, '导入图片失败'),
            updatedAt: nowIso(),
          });
        }
      }

      const importedCount = importedOutputs.filter((output) => output.status === 'imported').length;
      const failedImports = importedOutputs.filter((output) => output.status === 'import_failed');
      const status: ImageGenerationJobStatus = importedCount > 0 ? 'succeeded' : 'import_failed';
      const statusReason = status === 'import_failed' ? 'asset_import_failed' : null;
      const errorMessage = failedImports[0]?.errorMessage ?? null;
      const finalEventType = status === 'succeeded' ? 'job_succeeded' : 'job_import_failed';

      job = {
        ...job,
        status,
        statusReason,
        errorMessage,
        completedAt: syncedAt,
        nextSyncAt: null,
        outputs: importedOutputs,
        events: [...job.events, createEvent(finalEventType, status, errorMessage, statusReason, syncedAt)],
      };

      await this.repository.saveJob(job);
      this.broadcastJob(job, finalEventType);

      if (status === 'succeeded') {
        this.broadcastImportedAssets(job);
      }

      return detailJob(job);
    } catch (error) {
      const failedAt = nowIso();
      job = {
        ...job,
        syncAttempts: job.syncAttempts + 1,
        lastSyncedAt: failedAt,
        nextSyncAt: getScheduledNextSync(settings.pollIntervalMs, new Date(failedAt)),
        updatedAt: failedAt,
        events: [
          ...job.events,
          createEvent('job_sync_failed', job.status, sanitizeMessage(error, '同步任务失败'), 'provider_poll_failed', failedAt),
        ],
      };

      await this.repository.saveJob(job);

      if (error instanceof AiImageError) {
        return detailJob(job);
      }

      return detailJob(job);
    }
  }

  async cancelJob(jobId: string): Promise<ImageGenerationJobDetail> {
    const job = await this.getJobRecordOrThrow(jobId);

    if (job.status === 'succeeded') {
      throw new AiImageError('AI_IMAGE_JOB_STATE_CONFLICT', '任务已成功完成，不能取消', 409, false);
    }

    if (isTerminalJobStatus(job.status)) {
      return detailJob(job);
    }

    const canceledAt = nowIso();
    const canceledJob: ImageGenerationJobRecord = {
      ...job,
      status: 'canceled',
      statusReason: 'canceled_by_user',
      completedAt: canceledAt,
      nextSyncAt: null,
      updatedAt: canceledAt,
      events: [...job.events, createEvent('job_canceled', 'canceled', null, 'canceled_by_user', canceledAt)],
    };

    await this.repository.saveJob(canceledJob);
    this.broadcastJob(canceledJob, 'job_canceled');

    return detailJob(canceledJob);
  }

  async syncDueJobs(limit: number): Promise<ImageGenerationSyncDueResult> {
    const dueJobs = await this.repository.listDueJobs(new Date(), limit);
    const result: ImageGenerationSyncDueResult = {
      picked: dueJobs.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const job of dueJobs) {
      const synced = await this.syncJob(job.id);
      result.processed += 1;

      if (synced.status === 'succeeded') {
        result.succeeded += 1;
      }

      if (synced.status === 'failed' || synced.status === 'timed_out' || synced.status === 'import_failed') {
        result.failed += 1;
      }
    }

    return result;
  }
}

export const imageGenerationService = new ImageGenerationService();
