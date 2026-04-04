import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Config, PageInfo } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAGES_DIR = path.join(DATA_DIR, 'pages');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  currentPageId: null,
  pages: [],
};

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PAGES_DIR, { recursive: true });
}

export async function loadConfig(): Promise<Config> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return DEFAULT_CONFIG;
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
