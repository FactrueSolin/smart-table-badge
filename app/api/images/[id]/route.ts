import { NextRequest, NextResponse } from 'next/server';
import { getImageContent } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getImageContent(id);

  if (!result) {
    return new NextResponse('图片不存在', { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': result.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
