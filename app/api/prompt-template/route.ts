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

    const requiredPlaceholders = ['{{规范内容}}', '{{当前代码}}', '{{用户需求}}'];
    const missing = requiredPlaceholders.filter((p) => !content.includes(p));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `模板缺少占位符: ${missing.join('、')}` },
        { status: 400 }
      );
    }

    writeFileSync(TEMPLATE_PATH, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
