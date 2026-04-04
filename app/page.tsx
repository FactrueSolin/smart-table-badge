'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export default function Home() {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/sse');
    eventSourceRef.current = es;

    es.addEventListener('content-changed', (event) => {
      // 内容变更，刷新 iframe
      setIframeSrc((prev) => {
        const url = new URL('/api/current/view', window.location.origin);
        url.searchParams.set('t', String(Date.now()));
        return url.toString();
      });
    });

    es.onerror = () => {
      // SSE 断开时自动重连（EventSource 默认会自动重连）
    };

    return es;
  }, []);

  useEffect(() => {
    // 初始加载当前页面
    fetch('/api/current')
      .then((res) => res.json())
      .then((data) => {
        if (data.page) {
          setIframeSrc(`/api/pages/${data.page.id}`);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('加载失败');
        setLoading(false);
      });

    // 建立 SSE 连接
    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [connectSSE]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!iframeSrc) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">暂无内容，请先在管理后台上传页面</p>
      </div>
    );
  }

  return (
    <iframe
      src={iframeSrc}
      className="w-full h-screen border-0"
      title="display"
    />
  );
}
