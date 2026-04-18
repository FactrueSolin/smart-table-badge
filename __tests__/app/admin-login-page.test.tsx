// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn<(href: string) => void>();
const refreshMock = vi.fn<() => void>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

import LoginPage from '@/app/admin/login/page';

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });
}

describe('app/admin/login/page', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('登录成功后跳转到管理后台', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ success: true }));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('输入管理密码'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin');
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('后端返回空密码错误时展示报错文案', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({ error: '请输入密码' }, { status: 400 }),
    );

    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('请输入密码')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('后端未返回明确错误时使用默认报错文案', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({}, { status: 500 }));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('输入管理密码'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('登录失败')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('网络异常时展示网络错误', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('输入管理密码'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('网络错误')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
