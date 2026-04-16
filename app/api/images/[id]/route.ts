import { NextRequest, NextResponse } from 'next/server';
import { deleteImageAsset, getImageAsset, getImageContent, renameImageAsset } from '@/lib/storage';
import { broadcast } from '@/lib/sse';

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { name?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: '缺少图片名称' }, { status: 400 });
    }

    const image = await renameImageAsset(id, name);

    if (!image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }

    broadcast('content-changed', { action: 'rename', type: 'image', id, timestamp: Date.now() });

    return NextResponse.json({
      ...image,
      imageUrl: `${request.nextUrl.origin}/api/images/${image.id}`,
      pageUrl: image.pageId ? `${request.nextUrl.origin}/api/pages/${image.pageId}` : null,
    });
  } catch (err) {
    console.error('[api/images/:id] rename failed', err);
    return NextResponse.json({ error: '重命名失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const image = await getImageAsset(id);

    if (!image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }

    await deleteImageAsset(id);

    broadcast('content-changed', { action: 'delete', type: 'image', id, pageId: image.pageId, timestamp: Date.now() });

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error('[api/images/:id] delete failed', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
