export interface PageInfo {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
}

export interface ImageAsset {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
}

export interface Config {
  currentPageId: string | null;
  pages: PageInfo[];
  images: ImageAsset[];
}
