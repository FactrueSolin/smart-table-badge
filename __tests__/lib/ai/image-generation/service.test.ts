import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageGenerationImporter } from '@/lib/ai/image-generation/importer';
import type { ImageGenerationProvider } from '@/lib/ai/image-generation/providers/types';
import type { ImageGenerationRepository } from '@/lib/ai/image-generation/repository';
import { ImageGenerationService } from '@/lib/ai/image-generation/service';
import type { ImageGenerationJobRecord } from '@/lib/ai/image-generation/types';

vi.mock('@/lib/sse', () => ({
  broadcast: vi.fn(),
}));

function buildJob(overrides: Partial<ImageGenerationJobRecord> = {}): ImageGenerationJobRecord {
  const now = Date.now();
  const submittedAt = new Date(now - 1_000).toISOString();
  const nextSyncAt = new Date(now - 1).toISOString();

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
    nextSyncAt,
    submittedAt,
    processingStartedAt: null,
    completedAt: null,
    idempotencyKey: null,
    requestFingerprint: 'fingerprint',
    providerRequestPayload: null,
    providerResponsePayload: null,
    outputs: [],
    events: [],
    createdAt: submittedAt,
    updatedAt: submittedAt,
    ...overrides,
  };
}

function createMemoryRepository(initialJobs: ImageGenerationJobRecord[] = []): ImageGenerationRepository {
  const jobs = new Map(initialJobs.map((job) => [job.id, structuredClone(job)]));

  return {
    async getJob(jobId) {
      const job = jobs.get(jobId);
      return job ? structuredClone(job) : null;
    },
    async getJobByIdempotencyKey(key) {
      const job = [...jobs.values()].find((item) => item.idempotencyKey === key);
      return job ? structuredClone(job) : null;
    },
    async createJob(job) {
      jobs.set(job.id, structuredClone(job));
      return structuredClone(job);
    },
    async saveJob(job) {
      jobs.set(job.id, structuredClone(job));
      return structuredClone(job);
    },
    async listJobs() {
      return [...jobs.values()].map((job) => structuredClone(job));
    },
    async listDueJobs() {
      return [...jobs.values()].map((job) => structuredClone(job));
    },
  };
}

describe('ImageGenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MODELSCOPE_IMAGE_ALLOWED_MODELS;
    delete process.env.MODELSCOPE_IMAGE_DEFAULT_MODEL;
  });

  it('创建任务后提交到 provider 并返回 submitted 状态', async () => {
    const repository = createMemoryRepository();
    const importer: ImageGenerationImporter = {
      importOutput: vi.fn(),
    };
    const provider: ImageGenerationProvider = {
      provider: 'modelscope',
      submit: vi.fn().mockResolvedValue({ taskId: 'ms_task_1', requestId: 'req_1' }),
      getTask: vi.fn(),
    };
    const service = new ImageGenerationService({
      repository,
      importer,
      createProvider: () => provider,
    });

    const result = await service.createJob({
      name: '春季海报',
      mode: 'text_to_image',
      prompt: 'a spring poster',
      model: 'Qwen/Qwen-Image',
      size: '1024x1024',
      steps: 20,
      guidance: 3.5,
    });

    expect(result.status).toBe('submitted');
    expect(result.remoteTaskId).toBe('ms_task_1');
    expect(vi.mocked(provider.submit)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'Qwen/Qwen-Image',
        prompt: 'a spring poster',
      }),
    );
  });

  it('相同幂等键和相同请求返回同一个任务，不同请求返回冲突', async () => {
    const repository = createMemoryRepository();
    const importer: ImageGenerationImporter = {
      importOutput: vi.fn(),
    };
    const provider: ImageGenerationProvider = {
      provider: 'modelscope',
      submit: vi.fn().mockResolvedValue({ taskId: 'ms_task_1' }),
      getTask: vi.fn(),
    };
    const service = new ImageGenerationService({
      repository,
      importer,
      createProvider: () => provider,
    });

    const first = await service.createJob(
      {
        name: '春季海报',
        mode: 'text_to_image',
        prompt: 'a spring poster',
        model: 'Qwen/Qwen-Image',
        size: '1024x1024',
      },
      { idempotencyKey: 'idem-1' },
    );
    const second = await service.createJob(
      {
        name: '春季海报',
        mode: 'text_to_image',
        prompt: 'a spring poster',
        model: 'Qwen/Qwen-Image',
        size: '1024x1024',
      },
      { idempotencyKey: 'idem-1' },
    );

    expect(second.id).toBe(first.id);

    await expect(
      service.createJob(
        {
          name: '另一个海报',
          mode: 'text_to_image',
          prompt: 'another prompt',
          model: 'Qwen/Qwen-Image',
          size: '1024x1024',
        },
        { idempotencyKey: 'idem-1' },
      ),
    ).rejects.toMatchObject({
      code: 'AI_IMAGE_IDEMPOTENCY_CONFLICT',
      status: 409,
    });
  });

  it('同步成功任务后导入图片资产并标记为 succeeded', async () => {
    const repository = createMemoryRepository([buildJob()]);
    const importer: ImageGenerationImporter = {
      importOutput: vi.fn().mockResolvedValue({
        imageAssetId: 'img_1',
        pageId: 'page_1',
        imageUrl: '/api/images/img_1',
        pageUrl: '/api/pages/page_1',
      }),
    };
    const provider: ImageGenerationProvider = {
      provider: 'modelscope',
      submit: vi.fn(),
      getTask: vi.fn().mockResolvedValue({
        status: 'succeeded',
        outputImages: ['https://example.com/1.png'],
      }),
    };
    const service = new ImageGenerationService({
      repository,
      importer,
      createProvider: () => provider,
    });

    const result = await service.syncJob('job_test');

    expect(result.status).toBe('succeeded');
    expect(result.outputs[0]).toMatchObject({
      status: 'imported',
      imageAssetId: 'img_1',
      pageId: 'page_1',
    });
    expect(vi.mocked(importer.importOutput)).toHaveBeenCalledTimes(1);
  });
});
