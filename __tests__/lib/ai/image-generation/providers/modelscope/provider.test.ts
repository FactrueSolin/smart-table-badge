import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModelScopeImageGenerationProvider } from '@/lib/ai/image-generation/providers/modelscope/provider';

describe('ModelScopeImageGenerationProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MODELSCOPE_API_TOKEN;
    delete process.env.MODELSCOPE_API_BASE_URL;
  });

  it('提交任务时携带异步头并返回 taskId', async () => {
    process.env.MODELSCOPE_API_TOKEN = 'token';
    process.env.MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ task_id: 'task_123', request_id: 'req_123' }), { status: 200 }),
    );
    const provider = new ModelScopeImageGenerationProvider();

    const result = await provider.submit({
      model: 'Qwen/Qwen-Image',
      prompt: 'a cat',
      size: '1024x1024',
    });

    expect(result.taskId).toBe('task_123');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api-inference.modelscope.cn/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'X-ModelScope-Async-Mode': 'true',
        }),
      }),
    );
  });

  it('查询任务时把 ModelScope 状态映射为统一状态', async () => {
    process.env.MODELSCOPE_API_TOKEN = 'token';
    process.env.MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ task_status: 'SUCCEED', output_images: ['https://img.example/a.png'] }), {
        status: 200,
      }),
    );
    const provider = new ModelScopeImageGenerationProvider();

    const result = await provider.getTask('task_123');

    expect(result.status).toBe('succeeded');
    expect(result.outputImages).toEqual(['https://img.example/a.png']);
  });
});
