import { NextRequest, NextResponse } from 'next/server';
import { deletePage, getPageContent } from '@/lib/storage';
import { broadcast } from '@/lib/sse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const content = await getPageContent(id);
  if (!content) {
    return NextResponse.json({ error: '页面不存在' }, { status: 404 });
  }
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = await deletePage(id);
  if (!success) {
    return NextResponse.json({ error: '页面不存在' }, { status: 404 });
  }
  broadcast('content-changed', { action: 'delete', pageId: id, timestamp: Date.now() });
  return NextResponse.json({ success: true });
}
