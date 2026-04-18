import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Config, ImageAsset, ImageIndex, PageInfo } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAGES_DIR = path.join(DATA_DIR, 'pages');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG_FILE = path.join(DATA_DIR, 'config.default.json');
const IMAGES_INDEX_FILE = path.join(DATA_DIR, 'images.json');

export interface AddImageOptions {
  source?: 'upload' | 'ai_generated';
  generationJobId?: string | null;
  generationOutputId?: string | null;
  generatorProvider?: string | null;
  generatorModel?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
}

const DEFAULT_CONFIG: Config = {
  currentPageId: null,
  pages: [],
  images: [],
};

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

function normalizeImageAsset(image: Partial<ImageAsset>): ImageAsset {
  const uploadedAt = typeof image.uploadedAt === 'string' ? image.uploadedAt : new Date().toISOString();

  return {
    id: typeof image.id === 'string' ? image.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof image.name === 'string' && image.name.trim() ? image.name : '未命名图片',
    filename: typeof image.filename === 'string' ? image.filename : '',
    mimeType: typeof image.mimeType === 'string' ? image.mimeType : 'image/jpeg',
    size: typeof image.size === 'number' ? image.size : 0,
    uploadedAt,
    updatedAt: typeof image.updatedAt === 'string' ? image.updatedAt : uploadedAt,
    pageId: typeof image.pageId === 'string' ? image.pageId : null,
    source: image.source === 'ai_generated' ? 'ai_generated' : 'upload',
    generationJobId: typeof image.generationJobId === 'string' ? image.generationJobId : null,
    generationOutputId: typeof image.generationOutputId === 'string' ? image.generationOutputId : null,
    generatorProvider: typeof image.generatorProvider === 'string' ? image.generatorProvider : null,
    generatorModel: typeof image.generatorModel === 'string' ? image.generatorModel : null,
    prompt: typeof image.prompt === 'string' ? image.prompt : null,
    negativePrompt: typeof image.negativePrompt === 'string' ? image.negativePrompt : null,
  };
}

function sortImagesByUploadedAt(images: ImageAsset[], order: 'asc' | 'desc'): ImageAsset[] {
  return [...images].sort((a, b) => {
    const aTime = new Date(a.uploadedAt).getTime();
    const bTime = new Date(b.uploadedAt).getTime();

    return order === 'asc' ? aTime - bTime : bTime - aTime;
  });
}

async function readLegacyConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    try {
      const raw = await fs.readFile(DEFAULT_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw) as Config;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
}

export async function loadImageIndex(): Promise<ImageIndex> {
  await ensureDirs();

  try {
    const raw = await fs.readFile(IMAGES_INDEX_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ImageIndex;

    return {
      images: Array.isArray(parsed.images) ? parsed.images.map((image) => normalizeImageAsset(image)) : [],
    };
  } catch {
    const legacyConfig = await readLegacyConfig();
    const index: ImageIndex = {
      images: Array.isArray(legacyConfig.images)
        ? legacyConfig.images.map((image) => normalizeImageAsset(image))
        : [],
    };

    await saveImageIndex(index);
    return index;
  }
}

export async function saveImageIndex(index: ImageIndex): Promise<void> {
  await ensureDirs();
  await fs.writeFile(IMAGES_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

export async function loadConfig(): Promise<Config> {
  await ensureDirs();
  const config = await readLegacyConfig();
  const imageIndex = await loadImageIndex();

  return {
    currentPageId: config.currentPageId ?? null,
    pages: Array.isArray(config.pages) ? config.pages : [],
    images: imageIndex.images,
  };
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureDirs();

  await fs.writeFile(
    CONFIG_FILE,
    JSON.stringify({ currentPageId: config.currentPageId, pages: config.pages }, null, 2),
    'utf-8',
  );
  await saveImageIndex({ images: config.images });
}

export async function addPage(name: string, content: string): Promise<PageInfo> {
  const config = await loadConfig();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.html`;
  const pageInfo: PageInfo = { id, name, filename, uploadedAt: new Date().toISOString() };

  await fs.writeFile(path.join(PAGES_DIR, filename), content, 'utf-8');
  config.pages.push(pageInfo);

  // 如果没有当前页面，自动设为新上传的
  if (!config.currentPageId) {
    config.currentPageId = id;
  }

  await saveConfig(config);
  return pageInfo;
}

export async function getPageInfo(id: string): Promise<PageInfo | null> {
  const config = await loadConfig();
  return config.pages.find((page) => page.id === id) ?? null;
}

export async function deletePage(id: string): Promise<boolean> {
  const config = await loadConfig();
  const idx = config.pages.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  const page = config.pages[idx];
  try {
    await fs.unlink(path.join(PAGES_DIR, page.filename));
  } catch {
    // 文件可能已不存在，忽略错误
  }

  config.pages.splice(idx, 1);
  if (config.currentPageId === id) {
    config.currentPageId = config.pages.length > 0 ? config.pages[0].id : null;
  }

  await saveConfig(config);
  return true;
}

export async function setCurrentPage(id: string): Promise<boolean> {
  const config = await loadConfig();
  const exists = config.pages.some((p) => p.id === id);
  if (!exists) return false;

  config.currentPageId = id;
  await saveConfig(config);
  return true;
}

export async function getPageContent(id: string): Promise<string | null> {
  const config = await loadConfig();
  const page = config.pages.find((p) => p.id === id);
  if (!page) return null;

  try {
    return await fs.readFile(path.join(PAGES_DIR, page.filename), 'utf-8');
  } catch {
    return null;
  }
}

/** 生成图片展示 HTML 模板 */
function generateImagePageHtml(imageUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>图片展示</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="display-image" />
</body>
</html>`;
}

export async function listImages(order: 'asc' | 'desc' = 'desc'): Promise<ImageAsset[]> {
  const index = await loadImageIndex();
  return sortImagesByUploadedAt(index.images, order);
}


/** 保存图片文件并生成对应的 HTML 页面 */
export async function addImage(
  name: string,
  buffer: Buffer,
  mimeType: string,
  options: AddImageOptions = {},
): Promise<{ image: ImageAsset; page: PageInfo }> {
  await ensureDirs();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = mimeType.split('/')[1] || 'jpg';
  const filename = `${id}.${ext}`;
  const timestamp = new Date().toISOString();

  await fs.writeFile(path.join(IMAGES_DIR, filename), buffer);

  const imageUrl = `/api/images/${id}`;
  const htmlContent = generateImagePageHtml(imageUrl);
  const page = await addPage(name, htmlContent);

  const imageAsset: ImageAsset = {
    id,
    name,
    filename,
    mimeType,
    size: buffer.byteLength,
    uploadedAt: timestamp,
    updatedAt: timestamp,
    pageId: page.id,
    source: options.source ?? 'upload',
    generationJobId: options.generationJobId ?? null,
    generationOutputId: options.generationOutputId ?? null,
    generatorProvider: options.generatorProvider ?? null,
    generatorModel: options.generatorModel ?? null,
    prompt: options.prompt ?? null,
    negativePrompt: options.negativePrompt ?? null,
  };

  const imageIndex = await loadImageIndex();
  imageIndex.images.push(imageAsset);
  await saveImageIndex(imageIndex);

  return { image: imageAsset, page };
}

export async function getImageAsset(id: string): Promise<ImageAsset | null> {
  const imageIndex = await loadImageIndex();
  const image = imageIndex.images.find((item) => item.id === id);

  return image ?? null;
}

export async function getImageAssetByGenerationOutputId(generationOutputId: string): Promise<ImageAsset | null> {
  const imageIndex = await loadImageIndex();
  return imageIndex.images.find((item) => item.generationOutputId === generationOutputId) ?? null;
}

/** 获取图片文件内容 */
export async function getImageContent(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const imageIndex = await loadImageIndex();
  const image = imageIndex.images.find((img) => img.id === id);
  if (!image) return null;

  try {
    const buffer = await fs.readFile(path.join(IMAGES_DIR, image.filename));
    return { buffer, mimeType: image.mimeType };
  } catch {
    return null;
  }
}

export async function renameImageAsset(id: string, name: string): Promise<ImageAsset | null> {
  const imageIndex = await loadImageIndex();
  const image = imageIndex.images.find((item) => item.id === id);

  if (!image) {
    return null;
  }

  image.name = name;
  image.updatedAt = new Date().toISOString();
  await saveImageIndex(imageIndex);

  return image;
}

/** 删除图片及其对应的页面（如果存在） */
export async function deleteImageAsset(id: string): Promise<boolean> {
  const imageIndex = await loadImageIndex();
  const idx = imageIndex.images.findIndex((img) => img.id === id);
  if (idx === -1) return false;

  const image = imageIndex.images[idx];
  try {
    await fs.unlink(path.join(IMAGES_DIR, image.filename));
  } catch {
    // 文件可能已不存在，忽略错误
  }

  imageIndex.images.splice(idx, 1);

  if (image.pageId) {
    await deletePage(image.pageId).catch(() => {});
  }

  await saveImageIndex(imageIndex);
  return true;
}

export async function deleteImageAssets(ids: string[]): Promise<string[]> {
  const deletedIds: string[] = [];

  for (const id of ids) {
    const deleted = await deleteImageAsset(id);
    if (deleted) {
      deletedIds.push(id);
    }
  }

  return deletedIds;
}

export async function getCurrentPageContent(): Promise<{ page: PageInfo | null; content: string | null }> {
  const config = await loadConfig();
  if (!config.currentPageId) {
    return { page: null, content: null };
  }

  const page = config.pages.find((p) => p.id === config.currentPageId);
  if (!page) {
    return { page: null, content: null };
  }

  try {
    const content = await fs.readFile(path.join(PAGES_DIR, page.filename), 'utf-8');
    return { page, content };
  } catch {
    return { page, content: null };
  }
}
