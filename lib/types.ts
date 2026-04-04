export interface PageInfo {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
}

export interface Config {
  currentPageId: string | null;
  pages: PageInfo[];
}
