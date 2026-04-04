'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface PageInfo {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
}

type Tab = 'pages' | 'editor' | 'guide' | 'api';

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

  // 规范内容
  const [guideContent, setGuideContent] = useState('');
  const [guideLoading, setGuideLoading] = useState(false);

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

  // 加载 HTML 规范
  useEffect(() => {
    if (activeTab === 'guide' && !guideContent) {
      setGuideLoading(true);
      fetch('/api/guide')
        .then((res) => res.text())
        .then((text) => {
          setGuideContent(text);
          setGuideLoading(false);
        })
        .catch(() => setGuideLoading(false));
    }
  }, [activeTab, guideContent]);

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
                onClick={() => handleCopyMarkdown(guideContent)}
                disabled={!guideContent}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {copied ? '已复制' : '复制 Markdown'}
              </button>
            </div>
            <div className="p-6">
              {guideLoading ? (
                <p className="text-sm text-zinc-500">加载中...</p>
              ) : guideContent ? (
                <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 font-mono leading-relaxed">
                  {guideContent}
                </pre>
              ) : (
                <p className="text-sm text-zinc-500">加载失败</p>
              )}
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
