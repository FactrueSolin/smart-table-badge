// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AIImageWorkspace from '@/app/admin/_components/ai-image-workspace';

interface MockJobOutput {
  id: string;
  outputIndex: number;
  remoteUrl: string;
  status: 'pending_import' | 'imported' | 'import_failed';
  imageAssetId: string | null;
  pageId: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockJobEvent {
  id: string;
  type:
    | 'job_created'
    | 'job_submitted'
    | 'job_processing'
    | 'job_succeeded'
    | 'job_failed'
    | 'job_canceled'
    | 'job_import_failed'
    | 'job_sync_failed'
    | 'job_timed_out'
    | 'job_polled';
  status:
    | 'queued'
    | 'submitted'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'timed_out'
    | 'canceled'
    | 'import_failed';
  reason: string | null;
  message: string | null;
  createdAt: string;
}

interface MockJobDetail {
  id: string;
  status:
    | 'queued'
    | 'submitted'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'timed_out'
    | 'canceled'
    | 'import_failed';
  name: string;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  size: string | null;
  seed: number | null;
  steps: number | null;
  guidance: number | null;
  statusReason: string | null;
  errorMessage: string | null;
  outputs: MockJobOutput[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  syncAttempts: number;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  processingStartedAt: string | null;
  events: MockJobEvent[];
}

class MockEventSource {
  readonly url: string;
  readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();
  onerror: ((this: EventSource, event: Event) => unknown) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const nextListener = (event: MessageEvent<string>) => {
      if (typeof listener === 'function') {
        listener(event);
        return;
      }

      listener.handleEvent(event);
    };

    const current = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...current, nextListener]);
  }

  close(): void {}
}

function createJobDetail(overrides: Partial<MockJobDetail> = {}): MockJobDetail {
  return {
    id: 'job_1',
    status: 'succeeded',
    name: '深海玻璃柜',
    prompt:
      'A premium cosmetic display set inside a translucent undersea cabinet, cinematic lighting, jellyfish, teal and gold, product poster.',
    negativePrompt: 'blurry, watermark, low quality',
    model: 'Qwen/Qwen-Image',
    size: '1024x1024',
    seed: 12,
    steps: 30,
    guidance: 3.5,
    statusReason: null,
    errorMessage: null,
    outputs: [],
    createdAt: '2026-04-19T08:30:00.000Z',
    updatedAt: '2026-04-19T08:31:00.000Z',
    submittedAt: '2026-04-19T08:30:04.000Z',
    completedAt: '2026-04-19T08:31:00.000Z',
    syncAttempts: 2,
    lastSyncedAt: '2026-04-19T08:31:01.000Z',
    nextSyncAt: null,
    processingStartedAt: '2026-04-19T08:30:20.000Z',
    events: [
      {
        id: 'event_1',
        type: 'job_created',
        status: 'queued',
        reason: null,
        message: null,
        createdAt: '2026-04-19T08:30:00.000Z',
      },
      {
        id: 'event_2',
        type: 'job_submitted',
        status: 'submitted',
        reason: null,
        message: null,
        createdAt: '2026-04-19T08:30:04.000Z',
      },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('app/admin/_components/ai-image-workspace', () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('EventSource', MockEventSource);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('支持从真实任务列表复制参数回填到创建表单', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({
      items: [createJobDetail()],
      nextCursor: null,
    }));

    render(<AIImageWorkspace images={[]} />);

    expect(await screen.findByText('深海玻璃柜')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '复制参数再生成' }));

    expect(screen.getByLabelText('任务名称')).toHaveValue('深海玻璃柜');
    expect(screen.getByLabelText('Prompt')).toHaveValue(
      'A premium cosmetic display set inside a translucent undersea cabinet, cinematic lighting, jellyfish, teal and gold, product poster.',
    );
  });

  it('提交新任务后会调用真实接口并插入列表顶部', async () => {
    const createdJob = createJobDetail({
      id: 'job_2',
      status: 'submitted',
      name: 'premium spring sal',
      prompt: 'premium spring sale poster with realistic flowers and glass reflections',
      negativePrompt: null,
      seed: null,
      completedAt: null,
      processingStartedAt: null,
      syncAttempts: 0,
      lastSyncedAt: null,
      outputs: [],
    });

    fetchMock.mockImplementation(async (input, init) => {
      const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? 'GET';

      if (requestUrl === '/api/ai/images/jobs' && method === 'POST') {
        return jsonResponse({ job: createdJob }, 201);
      }

      return jsonResponse({
        items: [],
        nextCursor: null,
      });
    });

    render(<AIImageWorkspace images={[]} />);

    fireEvent.change(screen.getByLabelText('Prompt'), {
      target: { value: 'premium spring sale poster with realistic flowers and glass reflections' },
    });

    fireEvent.click(screen.getByRole('button', { name: '立即生成' }));

    await waitFor(() => {
      expect(screen.getByText('任务已提交，正在生成中。')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('任务名称')).toHaveValue('premium spring sal');
    expect(screen.getByText('premium spring sal')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/images/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
