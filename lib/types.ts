export interface PageInfo {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
}

export interface ImageAsset {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  updatedAt: string;
  pageId: string | null;
}

export interface ImageIndex {
  images: ImageAsset[];
}

export interface Config {
  currentPageId: string | null;
  pages: PageInfo[];
  images: ImageAsset[];
}
