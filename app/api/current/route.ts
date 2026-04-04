import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPageContent, setCurrentPage, loadConfig } from '@/lib/storage';
import { broadcast } from '@/lib/sse';

export async function GET() {
  const { page, content } = await getCurrentPageContent();
  if (!page) {
    return NextResponse.json({ page: null, content: null });
  }
  return NextResponse.json({ page, content });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId } = body as { pageId?: string };
    if (!pageId) {
      return NextResponse.json({ error: '缺少 pageId' }, { status: 400 });
    }

    const success = await setCurrentPage(pageId);
    if (!success) {
      return NextResponse.json({ error: '页面不存在' }, { status: 404 });
    }

    broadcast('content-changed', { action: 'switch', pageId, timestamp: Date.now() });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '切换失败' }, { status: 500 });
  }
}
