import { NextRequest, NextResponse } from 'next/server';
import { loadConfig, addPage } from '@/lib/storage';

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config.pages);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || file?.name || '未命名页面';

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    const content = await file.text();
    const page = await addPage(name, content);
    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    console.error('[api/pages] upload failed', err);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
