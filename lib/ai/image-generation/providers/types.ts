import type { ImageGenerationProviderName } from '@/lib/ai/image-generation/types';

export interface ProviderSubmitInput {
  model: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
  seed?: number;
  steps?: number;
  guidance?: number;
}

export interface ProviderSubmittedTask {
  taskId: string;
  requestId?: string;
  raw?: Record<string, unknown>;
}

export interface ProviderTaskSnapshot {
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  outputImages: string[];
  requestId?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}

export interface ImageGenerationProvider {
  readonly provider: ImageGenerationProviderName;
  submit(input: ProviderSubmitInput): Promise<ProviderSubmittedTask>;
  getTask(taskId: string): Promise<ProviderTaskSnapshot>;
}
