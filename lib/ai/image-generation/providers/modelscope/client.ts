import { AiImageError } from '@/lib/ai/image-generation/errors';
import { getImageGenerationSettings } from '@/lib/ai/image-generation/model-config';
import type { ProviderSubmitInput } from '@/lib/ai/image-generation/providers/types';

interface ModelScopeSubmitResponse {
  taskId: string;
  requestId?: string;
  raw?: Record<string, unknown>;
}

interface ModelScopeTaskResponse {
  taskStatus: string;
  outputImages: string[];
  requestId?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export class ModelScopeClient {
  private readonly settings = getImageGenerationSettings();

  private getHeaders(extraHeaders?: Record<string, string>): HeadersInit {
    return {
      Authorization: `Bearer ${this.settings.apiToken}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  private async readJsonResponse(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      const parsed = JSON.parse(text) as unknown;
      const record = asObject(parsed);
      return record ?? {};
    } catch {
      return {};
    }
  }

  async submitImageGeneration(input: ProviderSubmitInput): Promise<ModelScopeSubmitResponse> {
    if (!this.settings.apiToken) {
      throw new AiImageError('AI_IMAGE_PROVIDER_SUBMIT_FAILED', '未配置 MODELSCOPE_API_TOKEN', 502, false);
    }

    const response = await fetch(`${this.settings.apiBaseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: this.getHeaders({
        'X-ModelScope-Async-Mode': 'true',
      }),
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        negative_prompt: input.negativePrompt,
        size: input.size,
        seed: input.seed,
        steps: input.steps,
        guidance: input.guidance,
      }),
    });

    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new AiImageError(
        'AI_IMAGE_PROVIDER_SUBMIT_FAILED',
        getString(payload, 'message') || '生图任务提交失败',
        502,
        true,
      );
    }

    const taskId = getString(payload, 'task_id');

    if (!taskId) {
      throw new AiImageError('AI_IMAGE_PROVIDER_SUBMIT_FAILED', 'Provider 未返回 task_id', 502, false);
    }

    return {
      taskId,
      requestId: getString(payload, 'request_id'),
      raw: payload,
    };
  }

  async getTask(taskId: string): Promise<ModelScopeTaskResponse> {
    if (!this.settings.apiToken) {
      throw new AiImageError('AI_IMAGE_PROVIDER_POLL_FAILED', '未配置 MODELSCOPE_API_TOKEN', 502, false);
    }

    const response = await fetch(`${this.settings.apiBaseUrl}/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: this.getHeaders({
        'X-ModelScope-Task-Type': 'image_generation',
      }),
    });

    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new AiImageError(
        'AI_IMAGE_PROVIDER_POLL_FAILED',
        getString(payload, 'message') || '生图任务查询失败',
        502,
        true,
      );
    }

    return {
      taskStatus: getString(payload, 'task_status') || 'PENDING',
      outputImages: getStringArray(payload, 'output_images'),
      requestId: getString(payload, 'request_id'),
      errorMessage: getString(payload, 'message') || getString(payload, 'error'),
      raw: payload,
    };
  }
}
