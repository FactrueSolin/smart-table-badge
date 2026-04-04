import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('id');

  if (!pageId) {
    return new NextResponse('缺少页面ID', { status: 400 });
  }

  const dataDir = path.join(process.cwd(), 'data', 'pages');
  try {
    const files = await fs.readdir(dataDir);
    const filename = files.find((f) => f.startsWith(pageId));
    if (!filename) {
      return new NextResponse('页面不存在', { status: 404 });
    }
    const content = await fs.readFile(path.join(dataDir, filename), 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse('页面不存在', { status: 404 });
  }
}
