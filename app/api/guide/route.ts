import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const filePath = path.join(process.cwd(), 'docs', '手机展示HTML规范.md');
  const content = await fs.readFile(filePath, 'utf-8');
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
