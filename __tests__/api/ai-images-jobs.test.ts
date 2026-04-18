import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  isAuthenticated: vi.fn(),
}));

vi.mock('@/lib/ai/image-generation/service', () => ({
  imageGenerationService: {
    createJob: vi.fn(),
    listJobs: vi.fn(),
    getJob: vi.fn(),
    cancelJob: vi.fn(),
    syncDueJobs: vi.fn(),
  },
}));

describe('API: AI image jobs', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('POST /api/ai/images/jobs 未认证返回 401', async () => {
    const { isAuthenticated } = await import('@/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/ai/images/jobs', {
      method: 'POST',
      body: JSON.stringify({
        name: '海报',
        mode: 'text_to_image',
        prompt: 'a poster',
        model: 'Qwen/Qwen-Image',
      }),
    });

    const { POST } = await import('@/app/api/ai/images/jobs/route');
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('POST /api/ai/images/jobs 创建任务成功', async () => {
    const { isAuthenticated } = await import('@/lib/auth');
    const { imageGenerationService } = await import('@/lib/ai/image-generation/service');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(imageGenerationService.createJob).mockResolvedValue({
      id: 'job_1',
      provider: 'modelscope',
      mode: 'text_to_image',
      status: 'submitted',
      name: '海报',
      prompt: 'a poster',
      negativePrompt: null,
      model: 'Qwen/Qwen-Image',
      size: '1024x1024',
      seed: null,
      steps: null,
      guidance: null,
      remoteTaskId: 'task_1',
      statusReason: null,
      errorMessage: null,
      outputs: [],
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-19T00:00:01.000Z',
      submittedAt: '2026-04-19T00:00:01.000Z',
      completedAt: null,
      remoteRequestId: null,
      syncAttempts: 0,
      lastSyncedAt: null,
      nextSyncAt: null,
      processingStartedAt: null,
      events: [],
    });

    const request = new NextRequest('http://localhost/api/ai/images/jobs', {
      method: 'POST',
      body: JSON.stringify({
        name: '海报',
        mode: 'text_to_image',
        prompt: 'a poster',
        model: 'Qwen/Qwen-Image',
      }),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-1',
      },
    });

    const { POST } = await import('@/app/api/ai/images/jobs/route');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.job.id).toBe('job_1');
    expect(vi.mocked(imageGenerationService.createJob)).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '海报',
      }),
      { idempotencyKey: 'idem-1' },
    );
  });

  it('GET /api/ai/images/jobs 返回列表', async () => {
    const { isAuthenticated } = await import('@/lib/auth');
    const { imageGenerationService } = await import('@/lib/ai/image-generation/service');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(imageGenerationService.listJobs).mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const { GET } = await import('@/app/api/ai/images/jobs/route');
    const response = await GET(new NextRequest('http://localhost/api/ai/images/jobs?limit=10'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nextCursor).toBeNull();
    expect(vi.mocked(imageGenerationService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it('GET /api/ai/images/jobs/[id] 默认带 sync=true', async () => {
    const { isAuthenticated } = await import('@/lib/auth');
    const { imageGenerationService } = await import('@/lib/ai/image-generation/service');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(imageGenerationService.getJob).mockResolvedValue({
      id: 'job_1',
      provider: 'modelscope',
      mode: 'text_to_image',
      status: 'submitted',
      name: '海报',
      prompt: 'a poster',
      negativePrompt: null,
      model: 'Qwen/Qwen-Image',
      size: '1024x1024',
      seed: null,
      steps: null,
      guidance: null,
      remoteTaskId: 'task_1',
      statusReason: null,
      errorMessage: null,
      outputs: [],
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-19T00:00:01.000Z',
      submittedAt: '2026-04-19T00:00:01.000Z',
      completedAt: null,
      remoteRequestId: null,
      syncAttempts: 0,
      lastSyncedAt: null,
      nextSyncAt: null,
      processingStartedAt: null,
      events: [],
    });

    const { GET } = await import('@/app/api/ai/images/jobs/[id]/route');
    const response = await GET(new NextRequest('http://localhost/api/ai/images/jobs/job_1'), {
      params: Promise.resolve({ id: 'job_1' }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(imageGenerationService.getJob)).toHaveBeenCalledWith('job_1', { sync: true });
  });

  it('POST /api/internal/ai/images/jobs/sync-due 需要内部 token', async () => {
    process.env.INTERNAL_CRON_TOKEN = 'cron-secret';
    const { imageGenerationService } = await import('@/lib/ai/image-generation/service');
    vi.mocked(imageGenerationService.syncDueJobs).mockResolvedValue({
      picked: 1,
      processed: 1,
      succeeded: 1,
      failed: 0,
    });

    const { POST } = await import('@/app/api/internal/ai/images/jobs/sync-due/route');
    const response = await POST(
      new NextRequest('http://localhost/api/internal/ai/images/jobs/sync-due', {
        method: 'POST',
        body: JSON.stringify({ limit: 5 }),
        headers: {
          Authorization: 'Bearer cron-secret',
          'Content-Type': 'application/json',
        },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.processed).toBe(1);
  });
});
