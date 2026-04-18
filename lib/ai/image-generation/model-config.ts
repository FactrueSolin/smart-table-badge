import { AiImageError } from '@/lib/ai/image-generation/errors';
import type { ImageGenerationCreateInput, ImageGenerationProviderName } from '@/lib/ai/image-generation/types';

export interface NumericRange {
  min: number;
  max: number;
}

export interface ImageGenerationModelConfig {
  id: string;
  sizes: string[];
  defaultSize: string;
  steps: NumericRange;
  guidance: NumericRange;
}

export interface ImageGenerationSettings {
  provider: ImageGenerationProviderName;
  apiBaseUrl: string;
  apiToken: string;
  defaultModel: string;
  timeoutSeconds: number;
  pollIntervalMs: number;
  maxAttempts: number;
  importMaxBytes: number;
  allowedModels: ImageGenerationModelConfig[];
}

const DEFAULT_ALLOWED_MODELS: ImageGenerationModelConfig[] = [
  {
    id: 'Qwen/Qwen-Image',
    sizes: ['768x768', '1024x1024', '1328x1328'],
    defaultSize: '1024x1024',
    steps: { min: 1, max: 50 },
    guidance: { min: 1.5, max: 20 },
  },
];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveFloat(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isImageGenerationModelConfig(value: unknown): value is ImageGenerationModelConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    Array.isArray(record.sizes) &&
    record.sizes.every((size) => typeof size === 'string') &&
    typeof record.defaultSize === 'string' &&
    !!record.steps &&
    typeof record.steps === 'object' &&
    !!record.guidance &&
    typeof record.guidance === 'object'
  );
}

function parseAllowedModels(rawValue: string | undefined): ImageGenerationModelConfig[] {
  if (!rawValue) {
    return DEFAULT_ALLOWED_MODELS;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (Array.isArray(parsed) && parsed.every((item) => isImageGenerationModelConfig(item))) {
      return parsed;
    }
  } catch {
    const modelIds = rawValue
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (modelIds.length > 0) {
      return modelIds.map((id) => ({
        ...DEFAULT_ALLOWED_MODELS[0],
        id,
      }));
    }
  }

  return DEFAULT_ALLOWED_MODELS;
}

export function getImageGenerationSettings(): ImageGenerationSettings {
  const allowedModels = parseAllowedModels(process.env.MODELSCOPE_IMAGE_ALLOWED_MODELS);
  const defaultModel = process.env.MODELSCOPE_IMAGE_DEFAULT_MODEL?.trim() || allowedModels[0]?.id || 'Qwen/Qwen-Image';

  return {
    provider: 'modelscope',
    apiBaseUrl: process.env.MODELSCOPE_API_BASE_URL?.replace(/\/+$/, '') || 'https://api-inference.modelscope.cn',
    apiToken: process.env.MODELSCOPE_API_TOKEN?.trim() || '',
    defaultModel,
    timeoutSeconds: parsePositiveInt(process.env.MODELSCOPE_IMAGE_TIMEOUT_SECONDS, 300),
    pollIntervalMs: parsePositiveInt(process.env.MODELSCOPE_IMAGE_POLL_INTERVAL_MS, 5000),
    maxAttempts: parsePositiveInt(process.env.MODELSCOPE_IMAGE_MAX_ATTEMPTS, 60),
    importMaxBytes: Math.floor(parsePositiveFloat(process.env.AI_IMAGE_IMPORT_MAX_MB, 20) * 1024 * 1024),
    allowedModels,
  };
}

export function getAllowedModelOrThrow(modelId: string, settings: ImageGenerationSettings): ImageGenerationModelConfig {
  const model = settings.allowedModels.find((item) => item.id === modelId);

  if (!model) {
    throw new AiImageError('AI_IMAGE_MODEL_NOT_ALLOWED', '当前模型不在允许列表内', 422, false);
  }

  return model;
}

export function normalizeCreateInput(input: ImageGenerationCreateInput, settings: ImageGenerationSettings): ImageGenerationCreateInput {
  const modelId = input.model || settings.defaultModel;
  const model = getAllowedModelOrThrow(modelId, settings);

  return {
    ...input,
    model: modelId,
    size: input.size || model.defaultSize,
  };
}

export function validateCreateInputAgainstModel(input: ImageGenerationCreateInput, settings: ImageGenerationSettings): void {
  const model = getAllowedModelOrThrow(input.model, settings);

  if (input.size && !model.sizes.includes(input.size)) {
    throw new AiImageError('AI_IMAGE_SIZE_NOT_ALLOWED', '当前尺寸不在允许列表内', 422, false);
  }

  if (typeof input.steps === 'number' && (input.steps < model.steps.min || input.steps > model.steps.max)) {
    throw new AiImageError(
      'AI_IMAGE_INVALID_INPUT',
      `steps 必须在 ${model.steps.min} 到 ${model.steps.max} 之间`,
      422,
      false,
    );
  }

  if (
    typeof input.guidance === 'number' &&
    (input.guidance < model.guidance.min || input.guidance > model.guidance.max)
  ) {
    throw new AiImageError(
      'AI_IMAGE_INVALID_INPUT',
      `guidance 必须在 ${model.guidance.min} 到 ${model.guidance.max} 之间`,
      422,
      false,
    );
  }
}
