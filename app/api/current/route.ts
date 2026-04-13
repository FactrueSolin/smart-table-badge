import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPageContent, setCurrentPage, loadConfig } from '@/lib/storage';
import { broadcast } from '@/lib/sse';
import { isAuthenticated, isValidCurrentPageApiToken } from '@/lib/auth';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cookieAuth = await isAuthenticated();
  if (cookieAuth) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return isValidCurrentPageApiToken(token);
  }

  return false;
}

export async function GET() {
  const { page, content } = await getCurrentPageContent();
  if (!page) {
    return NextResponse.json({ page: null, content: null });
  }
  return NextResponse.json({ page, content });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

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
    return NextResponse.json({ success: true, pageId, timestamp: Date.now() });
  } catch {
    return NextResponse.json({ error: '切换失败' }, { status: 500 });
  }
}
