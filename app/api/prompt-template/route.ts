import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAuthenticated } from '@/lib/auth';

const TEMPLATE_PATH = join(process.cwd(), 'docs', '页面生成提示词.md');

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  try {
    const content = readFileSync(TEMPLATE_PATH, 'utf-8');
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { content } = body as { content: string };
    writeFileSync(TEMPLATE_PATH, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
