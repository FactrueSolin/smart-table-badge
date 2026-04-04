'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface PageInfo {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
}

type Tab = 'pages' | 'editor' | 'guide' | 'api';

const htmlGuideMarkdown = `# 手机展示 HTML 规范

## 概述

编写适合手机横屏全屏展示的 HTML 页面。手机作为"桌面显示器"使用时，页面应充分利用屏幕空间，避免滚动条和多余留白。

## 设备特性

- **方向**：横屏放置（landscape）
- **展示方式**：全屏显示，无浏览器地址栏和工具栏
- **交互**：无用户交互，纯展示用途

## HTML 模板

\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>展示页面</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #000; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .container {
      width: 100vw; height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .content {
      width: 100%; height: 100%; padding: 2rem;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <h1>欢迎</h1>
    </div>
  </div>
</body>
</html>
\`\`\`

## 关键要点

### 1. Viewport 设置

\`\`\`html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
\`\`\`

- \`width=device-width\`：宽度等于设备宽度
- \`initial-scale=1.0\`：初始缩放比例为 1
- \`maximum-scale=1.0\`：禁止放大
- \`user-scalable=no\`：禁止用户缩放

### 2. 全屏布局

\`\`\`css
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
\`\`\`

- 禁止滚动条出现
- 内容应适配屏幕尺寸，避免溢出

### 3. 横屏适配

使用 CSS 媒体查询针对横屏优化：

\`\`\`css
@media (orientation: landscape) {
  .content {
    flex-direction: row;
  }
}
\`\`\`

### 4. 字体大小

使用 \`vw\`/\`vh\` 单位让字体随屏幕自适应：

\`\`\`css
h1 { font-size: 8vw; }
p { font-size: 3vw; }
\`\`\`

### 5. 背景与颜色

- 推荐深色背景（\`#000\` 或 \`#111\`），减少屏幕刺眼
- 文字使用高对比度颜色（\`#fff\` 或 \`#eee\`）

### 6. 避免的内容

- 不要使用 \`position: fixed\` 固定元素（可能遮挡内容）
- 不要使用外部链接或需要交互的元素
- 不要使用过小的字体（横屏下难以阅读）

## 示例：信息展示页面

\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; color: #fff; font-family: sans-serif; }
    .container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2vh; }
    .title { font-size: 6vw; font-weight: bold; }
    .subtitle { font-size: 3vw; color: #888; }
    .stats { display: flex; gap: 8vw; margin-top: 4vh; }
    .stat { text-align: center; }
    .stat-value { font-size: 10vw; font-weight: bold; color: #4ade80; }
    .stat-label { font-size: 2.5vw; color: #666; margin-top: 1vh; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">今日数据</div>
    <div class="subtitle">实时更新</div>
    <div class="stats">
      <div class="stat"><div class="stat-value">128</div><div class="stat-label">访问量</div></div>
      <div class="stat"><div class="stat-value">56</div><div class="stat-label">订单数</div></div>
      <div class="stat"><div class="stat-value">¥9.2k</div><div class="stat-label">销售额</div></div>
    </div>
  </div>
</body>
</html>
\`\`\`

## 示例：图片轮播页面

\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    .slideshow { width: 100vw; height: 100vh; position: relative; }
    .slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1s; }
    .slide.active { opacity: 1; }
    .slide img { width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
  <div class="slideshow">
    <div class="slide active"><img src="https://picsum.photos/800/400?random=1" alt=""></div>
    <div class="slide"><img src="https://picsum.photos/800/400?random=2" alt=""></div>
    <div class="slide"><img src="https://picsum.photos/800/400?random=3" alt=""></div>
  </div>
  <script>
    const slides = document.querySelectorAll('.slide');
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 5000);
  </script>
</body>
</html>
\`\`\`
`;

const apiDocMarkdown = `# HTMLPush API 文档

## 页面管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | \`/api/pages\` | 获取所有已上传的 HTML 页面列表 |
| POST | \`/api/pages\` | 上传新的 HTML 文件（multipart/form-data） |
| GET | \`/api/pages/[id]\` | 获取指定页面的 HTML 内容 |
| DELETE | \`/api/pages/[id]\` | 删除指定页面 |

## 展示控制

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | \`/api/current\` | 获取当前展示的页面信息 |
| PUT | \`/api/current\` | 切换当前展示的页面（body: \`{ pageId: string }\`） |

## 实时推送

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | \`/api/sse\` | SSE 连接端点，推送内容变更事件 |

SSE 事件格式：
\`\`\`
event: content-changed
data: {"pageId": "xxx", "timestamp": 1234567890}
\`\`\`

## 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | \`/api/auth/login\` | 管理后台登录（body: \`{ password: string }\`） |
| POST | \`/api/auth/logout\` | 退出登录 |
| GET | \`/api/auth/check\` | 检查认证状态 |
`;

export default function AdminPage() {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('pages');

  // 编辑器状态
  const [editorName, setEditorName] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [saving, setSaving] = useState(false);

  // 复制状态
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检查认证状态
  useEffect(() => {
    fetch('/api/auth/check')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setAuthenticated(true);
          fetchData();
        } else {
          setAuthenticated(false);
          window.location.href = '/admin/login';
        }
      })
      .catch(() => {
        setAuthenticated(false);
        window.location.href = '/admin/login';
      });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [pagesRes, currentRes] = await Promise.all([
        fetch('/api/pages'),
        fetch('/api/current'),
      ]);
      const pagesData = await pagesRes.json();
      const currentData = await currentRes.json();
      setPages(pagesData);
      setCurrentPageId(currentData.page?.id ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    setEditorName(file.name.replace(/\.html?$/i, ''));
    setEditorContent(content);
    setActiveTab('editor');
  };

  const handleSaveEditor = async () => {
    if (!editorContent.trim()) return;
    setSaving(true);
    try {
      const blob = new Blob([editorContent], { type: 'text/html' });
      const formData = new FormData();
      formData.append('file', blob, `${editorName || 'page'}.html`);
      formData.append('name', editorName || '未命名页面');

      const res = await fetch('/api/pages', { method: 'POST', body: formData });
      if (res.ok) {
        setEditorName('');
        setEditorContent('');
        setActiveTab('pages');
        await fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async (id: string) => {
    const res = await fetch('/api/current', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: id }),
    });
    if (res.ok) {
      setCurrentPageId(id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此页面？')) return;
    const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  const handleTabChange = (tab: Tab) => {
    if (tab === 'editor') {
      setEditorName('');
      setEditorContent('');
    }
    setActiveTab(tab);
  };

  const handleCopyMarkdown = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 等待认证结果时显示加载
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-500 dark:text-zinc-400">验证中...</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-500 dark:text-zinc-400">加载中...</div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pages', label: '页面管理' },
    { key: 'editor', label: '代码编辑' },
    { key: 'guide', label: 'HTML 规范' },
    { key: 'api', label: 'API 文档' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">HTMLPush</h1>
            <nav className="flex gap-1 ml-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === tab.key
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'pages' && (
          <div className="space-y-6">
            {/* 上传区域 */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-4">上传 HTML 文件</h2>
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    点击选择或拖拽 HTML 文件
                  </p>
                </div>
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* 页面列表 */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100 p-6 pb-3">已上传页面</h2>
              {pages.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-zinc-500 dark:text-zinc-400">暂无页面，请先上传 HTML 文件</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pages.map((page) => (
                    <li key={page.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{page.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {new Date(page.uploadedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {currentPageId === page.id ? (
                          <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                            展示中
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSwitch(page.id)}
                            className="px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-500/20 transition-colors"
                          >
                            切换
                          </button>
                        )}
                        <a
                          href={`/api/pages/${page.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          预览
                        </a>
                        <button
                          onClick={() => handleDelete(page.id)}
                          className="px-2.5 py-1 text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 rounded-full hover:bg-red-500/20 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">HTML 代码编辑</h2>
              <button
                onClick={handleSaveEditor}
                disabled={saving || !editorContent.trim()}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '保存中...' : '保存为页面'}
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="页面名称（可选）"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            <textarea
              ref={textareaRef}
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              placeholder="在此输入 HTML 代码..."
              spellCheck={false}
              className="w-full h-96 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-950 dark:bg-zinc-950 text-zinc-100 font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">手机展示 HTML 规范</h2>
              <button
                onClick={() => handleCopyMarkdown(htmlGuideMarkdown)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {copied ? '已复制' : '复制 Markdown'}
              </button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 font-mono leading-relaxed">
                {htmlGuideMarkdown}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">API 文档</h2>
              <button
                onClick={() => handleCopyMarkdown(apiDocMarkdown)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {copied ? '已复制' : '复制 Markdown'}
              </button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 font-mono leading-relaxed">
                {apiDocMarkdown}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
