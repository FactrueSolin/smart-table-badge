import { ModelScopeImageGenerationProvider } from '@/lib/ai/image-generation/providers/modelscope/provider';
import type { ImageGenerationProvider } from '@/lib/ai/image-generation/providers/types';
import type { ImageGenerationProviderName } from '@/lib/ai/image-generation/types';

export function createImageGenerationProvider(provider: ImageGenerationProviderName): ImageGenerationProvider {
  if (provider === 'modelscope') {
    return new ModelScopeImageGenerationProvider();
  }

  return new ModelScopeImageGenerationProvider();
}
