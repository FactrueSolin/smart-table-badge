// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AIImageWorkspace from '@/app/admin/_components/ai-image-workspace';

describe('app/admin/_components/ai-image-workspace', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('支持从任务卡片复制参数回填到创建表单', async () => {
    render(<AIImageWorkspace images={[]} />);

    fireEvent.click(screen.getAllByRole('button', { name: '复制参数再生成' })[0]);

    expect(screen.getByLabelText('任务名称')).toHaveValue('深海玻璃柜');
    expect(screen.getByLabelText('Prompt')).toHaveValue(
      'A premium cosmetic display set inside a translucent undersea cabinet, cinematic lighting, jellyfish, teal and gold, product poster.',
    );
  });

  it('提交新任务后会插入列表并展示提交反馈', async () => {
    render(<AIImageWorkspace images={[]} />);

    fireEvent.change(screen.getByLabelText('Prompt'), {
      target: { value: 'premium spring sale poster with realistic flowers and glass reflections' },
    });

    fireEvent.click(screen.getByRole('button', { name: '立即生成' }));

    await waitFor(() => {
      expect(screen.getByText('任务已提交，正在生成中。结果会自动进入图库，刷新页面后仍可继续追踪。')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('任务名称')).toHaveValue('premium spring sal');
    expect(screen.getAllByText('premium spring sal').length).toBeGreaterThan(0);
  });
});
