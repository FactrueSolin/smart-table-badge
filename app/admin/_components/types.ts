export interface ImageAsset {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  updatedAt: string;
  pageId: string | null;
  imageUrl: string;
  pageUrl: string | null;
}
