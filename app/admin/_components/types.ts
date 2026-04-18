import type { ImageAsset as StoredImageAsset } from '@/lib/types';

export type ImageAsset = StoredImageAsset & {
  imageUrl: string;
  pageUrl: string | null;
};
