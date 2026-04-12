'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export default function Home() {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current;
    if (!sentinel) {
      return;
    }

    wakeLockRef.current = null;
    await sentinel.release().catch(() => {});
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!document.fullscreenElement || document.visibilityState !== 'visible') {
      return;
    }

    if (!('wakeLock' in navigator)) {
      return;
    }

    if (wakeLockRef.current && !wakeLockRef.current.released) {
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) {
          wakeLockRef.current = null;
        }
      });
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/sse');
    eventSourceRef.current = es;

    es.addEventListener('content-changed', () => {
      setIframeSrc(() => {
        const url = new URL('/api/current/view', window.location.origin);
        url.searchParams.set('t', String(Date.now()));
        return url.toString();
      });
    });

    es.onerror = () => {};

    return es;
  }, []);

  useEffect(() => {
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

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
      void releaseWakeLock();
    };
  }, [connectSSE, releaseWakeLock]);

  // 监听屏幕方向变化
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // 自动隐藏控制栏
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    if (isFullscreen) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }

      return () => {
        if (controlsTimerRef.current) {
          clearTimeout(controlsTimerRef.current);
        }
      };
    }

    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [isFullscreen, resetControlsTimer]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        // 尝试锁定横屏（非标准 API，部分浏览器支持）
        const orientation = screen.orientation as { lock?: (type: string) => Promise<void> };
        if (orientation?.lock) {
          await orientation.lock('landscape').catch(() => {});
        }
      } else {
        await releaseWakeLock();
        await document.exitFullscreen();
        if (screen.orientation?.unlock) {
          screen.orientation.unlock();
        }
      }
    } catch {
      // 全屏 API 不可用时静默失败
    }
  }, [releaseWakeLock]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenActive = !!document.fullscreenElement;
      setIsFullscreen(fullscreenActive);
      setShowControls(true);

      if (fullscreenActive) {
        void requestWakeLock();
        return;
      }

      void releaseWakeLock();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && document.fullscreenElement) {
        void requestWakeLock();
        return;
      }

      if (document.visibilityState !== 'visible') {
        void releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [releaseWakeLock, requestWakeLock]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-zinc-500">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!iframeSrc) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-zinc-500">暂无内容，请先在管理后台上传页面</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden"
      onClick={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <iframe
        src={iframeSrc}
        className="w-full h-full border-0"
        title="display"
        allowFullScreen
      />

      {/* 控制栏 */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = '/admin';
          }}
          className="px-3 py-1.5 text-xs text-white/80 bg-white/10 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          管理后台
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="px-3 py-1.5 text-xs text-white/80 bg-white/10 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          {isFullscreen ? '退出全屏' : '全屏'}
        </button>
      </div>

      {/* 横屏提示 */}
      {!isLandscape && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center text-white">
            <svg className="mx-auto w-12 h-12 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-lg font-medium">请横屏放置手机</p>
            <p className="text-sm text-zinc-400 mt-1">以获得最佳展示效果</p>
          </div>
        </div>
      )}
    </div>
  );
}
