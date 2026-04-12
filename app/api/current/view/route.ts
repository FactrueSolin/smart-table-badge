import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPageContent, getPageContent } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('id');

  if (!pageId) {
    const { content } = await getCurrentPageContent();
    if (!content) {
      return new NextResponse('页面不存在', { status: 404 });
    }

    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const content = await getPageContent(pageId);
  if (!content) {
    return new NextResponse('页面不存在', { status: 404 });
  }

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
