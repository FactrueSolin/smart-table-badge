// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

type RegisteredListener = (event: Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly withCredentials = false;
  readonly readyState = 1;
  onerror: ((this: EventSource, event: Event) => unknown) | null = null;
  closed = false;

  private readonly listeners = new Map<string, RegisteredListener[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  static reset() {
    MockEventSource.instances = [];
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const registeredListener: RegisteredListener =
      typeof listener === 'function'
        ? listener
        : (event: Event) => {
            listener.handleEvent(event);
          };
    const listeners = this.listeners.get(type) ?? [];

    listeners.push(registeredListener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  emit(type: string) {
    const listeners = this.listeners.get(type) ?? [];

    for (const listener of listeners) {
      listener(new Event(type));
    }
  }
}

describe('app/page', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    MockEventSource.reset();

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 720,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('加载当前页面后渲染展示 iframe', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        page: {
          id: 'page-1',
        },
      }),
    );

    render(<Home />);

    const iframe = await screen.findByTitle('display');

    expect(iframe).toHaveAttribute('src', '/api/pages/page-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/current');
    expect(MockEventSource.instances[0]?.url).toBe('/api/sse');
  });

  it('没有当前页面时展示空状态提示', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        page: null,
        content: null,
      }),
    );

    render(<Home />);

    expect(await screen.findByText('暂无内容，请先在管理后台上传页面')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));

    render(<Home />);

    expect(await screen.findByText('加载失败')).toBeInTheDocument();
  });

  it('收到 SSE 更新后刷新 iframe，并在卸载时关闭连接', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123_456_789);

    fetchMock.mockResolvedValue(
      createJsonResponse({
        page: {
          id: 'page-1',
        },
      }),
    );

    const { unmount } = render(<Home />);

    const iframe = await screen.findByTitle('display');
    const eventSource = MockEventSource.instances[0];

    expect(eventSource).toBeDefined();

    act(() => {
      eventSource?.emit('content-changed');
    });

    await waitFor(() => {
      expect(iframe).toHaveAttribute(
        'src',
        new URL('/api/current/view', window.location.origin)
          .toString()
          .concat('?t=123456789'),
      );
    });

    unmount();

    expect(eventSource?.closed).toBe(true);
    nowSpy.mockRestore();
  });
});
