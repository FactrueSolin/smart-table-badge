import { NextRequest, NextResponse } from 'next/server';
import { addImage, deleteImageAssets, listImages } from '@/lib/storage';
import { broadcast } from '@/lib/sse';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type SortParam = 'uploadedAt-desc' | 'uploadedAt-asc';

function getImageUrls(origin: string, imageId: string, pageId: string | null) {
  return {
    imageUrl: `${origin}/api/images/${imageId}`,
    pageUrl: pageId ? `${origin}/api/pages/${pageId}` : null,
  };
}

export async function GET(request: NextRequest) {
  const sort = request.nextUrl.searchParams.get('sort') as SortParam | null;
  const order = sort === 'uploadedAt-asc' ? 'asc' : 'desc';
  const images = await listImages(order);

  return NextResponse.json(
    images.map((image) => ({
      ...image,
      ...getImageUrls(request.nextUrl.origin, image.id, image.pageId),
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || file?.name || '未命名图片';

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '不支持的图片格式，仅支持 jpg、png、gif、webp、svg、avif' }, { status: 415 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { image, page } = await addImage(name, buffer, file.type);

    broadcast('content-changed', { action: 'upload', type: 'image', id: image.id, pageId: page.id, timestamp: Date.now() });

    return NextResponse.json({
      image: {
        ...image,
        ...getImageUrls(request.nextUrl.origin, image.id, image.pageId),
      },
      page,
    }, { status: 201 });
  } catch (err) {
    console.error('[api/images] upload failed', err);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: '缺少待删除的图片 ID' }, { status: 400 });
    }

    const deletedIds = await deleteImageAssets(ids);

    broadcast('content-changed', { action: 'delete', type: 'image', ids: deletedIds, timestamp: Date.now() });

    return NextResponse.json({ deletedIds });
  } catch (err) {
    console.error('[api/images] batch delete failed', err);
    return NextResponse.json({ error: '批量删除失败' }, { status: 500 });
  }
}
