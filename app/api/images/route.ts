import { NextRequest, NextResponse } from 'next/server';
import { addImage, deleteImageAssets, listImages } from '@/lib/storage';
import { broadcast } from '@/lib/sse';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { deletedIdsResponseSchema, errorResponseSchema } from '@/lib/openapi/schemas/common';
import {
  imageBatchDeleteRequestSchema,
  imageListSchema,
  imageListQuerySchema,
  imageUploadRequestSchema,
  imageUploadResponseSchema,
} from '@/lib/openapi/schemas/image';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type SortParam = 'uploadedAt-desc' | 'uploadedAt-asc';

export const registerImagesCollectionOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/images',
    tags: ['图床管理'],
    summary: '获取图片列表',
    request: {
      query: imageListQuerySchema,
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: imageListSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/images',
    tags: ['图床管理'],
    summary: '上传图片并生成展示页',
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: imageUploadRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: '上传成功',
        content: {
          'application/json': {
            schema: imageUploadResponseSchema,
          },
        },
      },
      400: {
        description: '缺少文件',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      413: {
        description: '文件过大',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      415: {
        description: '文件类型不支持',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '上传失败',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/images',
    tags: ['图床管理'],
    summary: '批量删除图片',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: imageBatchDeleteRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: '删除成功',
        content: {
          'application/json': {
            schema: deletedIdsResponseSchema,
          },
        },
      },
      400: {
        description: '请求参数错误',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '批量删除失败',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });
});

registerImagesCollectionOpenApi();

function getImageUrls(imageId: string, pageId: string | null) {
  return {
    imageUrl: `/api/images/${imageId}`,
    pageUrl: pageId ? `/api/pages/${pageId}` : null,
  };
}

export async function GET(request: NextRequest) {
  const sort = request.nextUrl.searchParams.get('sort') as SortParam | null;
  const order = sort === 'uploadedAt-asc' ? 'asc' : 'desc';
  const images = await listImages(order);

  return NextResponse.json(
    images.map((image) => ({
      ...image,
      ...getImageUrls(image.id, image.pageId),
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
        ...getImageUrls(image.id, image.pageId),
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
