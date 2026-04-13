import { NextRequest, NextResponse } from 'next/server';
import { addImage } from '@/lib/storage';
import { broadcast } from '@/lib/sse';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || file?.name || '未命名图片';

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '不支持的图片格式，仅支持 jpg、png、gif、webp、svg、avif' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { image, page } = await addImage(name, buffer, file.type);

    broadcast('content-changed', { action: 'upload', type: 'image', id: image.id, pageId: page.id, timestamp: Date.now() });

    return NextResponse.json({ image, page }, { status: 201 });
  } catch (err) {
    console.error('[api/images] upload failed', err);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
