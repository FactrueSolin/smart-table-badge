import { AiImageError } from '@/lib/ai/image-generation/errors';
import { getImageGenerationSettings } from '@/lib/ai/image-generation/model-config';
import type { ImageGenerationJobRecord, ImageGenerationJobOutput } from '@/lib/ai/image-generation/types';
import { addImage, getImageAssetByGenerationOutputId, getPageInfo } from '@/lib/storage';

export interface ImportedImageOutput {
  imageAssetId: string;
  pageId: string | null;
  imageUrl: string;
  pageUrl: string | null;
}

export interface ImageGenerationImporter {
  importOutput(job: ImageGenerationJobRecord, output: ImageGenerationJobOutput): Promise<ImportedImageOutput>;
}

function getImportedOutputName(job: ImageGenerationJobRecord, outputIndex: number): string {
  return `${job.name}-${outputIndex + 1}`;
}

export class RemoteImageGenerationImporter implements ImageGenerationImporter {
  private readonly settings = getImageGenerationSettings();

  async importOutput(job: ImageGenerationJobRecord, output: ImageGenerationJobOutput): Promise<ImportedImageOutput> {
    const existingAsset = await getImageAssetByGenerationOutputId(output.id);

    if (existingAsset) {
      const page = existingAsset.pageId ? await getPageInfo(existingAsset.pageId) : null;

      return {
        imageAssetId: existingAsset.id,
        pageId: existingAsset.pageId,
        imageUrl: `/api/images/${existingAsset.id}`,
        pageUrl: page ? `/api/pages/${page.id}` : null,
      };
    }

    const response = await fetch(output.remoteUrl);

    if (!response.ok) {
      throw new AiImageError('AI_IMAGE_IMPORT_FAILED', '下载远端图片失败', 502, true);
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';

    if (!mimeType.startsWith('image/')) {
      throw new AiImageError('AI_IMAGE_IMPORT_FAILED', '远端结果不是有效图片', 502, false);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > this.settings.importMaxBytes) {
      throw new AiImageError('AI_IMAGE_IMPORT_FAILED', '远端图片大小超出限制', 502, false);
    }

    const { image, page } = await addImage(getImportedOutputName(job, output.outputIndex), buffer, mimeType, {
      source: 'ai_generated',
      generationJobId: job.id,
      generationOutputId: output.id,
      generatorProvider: job.provider,
      generatorModel: job.model,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
    });

    return {
      imageAssetId: image.id,
      pageId: page.id,
      imageUrl: `/api/images/${image.id}`,
      pageUrl: `/api/pages/${page.id}`,
    };
  }
}

export const imageGenerationImporter = new RemoteImageGenerationImporter();
