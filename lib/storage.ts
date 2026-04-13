import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Config, PageInfo, ImageAsset } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAGES_DIR = path.join(DATA_DIR, 'pages');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG_FILE = path.join(DATA_DIR, 'config.default.json');

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

export async function loadConfig(): Promise<Config> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    try {
      const raw = await fs.readFile(DEFAULT_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw) as Config;
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureDirs();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
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


/** 保存图片文件并生成对应的 HTML 页面 */
export async function addImage(name: string, buffer: Buffer, mimeType: string): Promise<{ image: ImageAsset; page: PageInfo }> {
  await ensureDirs();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = mimeType.split('/')[1] || 'jpg';
  const filename = `${id}.${ext}`;
  const imageAsset: ImageAsset = { id, filename, mimeType, uploadedAt: new Date().toISOString() };

  await fs.writeFile(path.join(IMAGES_DIR, filename), buffer);

  // 保存图片元数据到配置
  const config = await loadConfig();
  if (!config.images) {
    config.images = [];
  }
  config.images.push(imageAsset);
  await saveConfig(config);

  const imageUrl = `/api/images/${id}`;
  const htmlContent = generateImagePageHtml(imageUrl);
  const page = await addPage(name, htmlContent);

  return { image: imageAsset, page };
}

/** 获取图片文件内容 */
export async function getImageContent(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const config = await loadConfig();
  const image = config.images?.find((img) => img.id === id);
  if (!image) return null;

  try {
    const buffer = await fs.readFile(path.join(IMAGES_DIR, image.filename));
    return { buffer, mimeType: image.mimeType };
  } catch {
    return null;
  }
}

/** 删除图片及其对应的页面（如果存在） */
export async function deleteImageAsset(id: string): Promise<boolean> {
  const config = await loadConfig();
  const idx = config.images?.findIndex((img) => img.id === id) ?? -1;
  if (idx === -1) return false;

  const image = config.images![idx];
  try {
    await fs.unlink(path.join(IMAGES_DIR, image.filename));
  } catch {
    // 文件可能已不存在，忽略错误
  }

  config.images!.splice(idx, 1);

  // 同时删除对应的页面（页面 ID 与图片 ID 相同）
  await deletePage(id).catch(() => {});

  await saveConfig(config);
  return true;
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
