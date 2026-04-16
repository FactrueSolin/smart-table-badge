import { NextRequest, NextResponse } from 'next/server';
import { deleteImageAsset, getImageAsset, getImageContent, renameImageAsset } from '@/lib/storage';
import { broadcast } from '@/lib/sse';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { deletedByIdResponseSchema, errorResponseSchema, idParamSchema } from '@/lib/openapi/schemas/common';
import { imageAssetWithUrlsSchema, imageRenameRequestSchema } from '@/lib/openapi/schemas/image';

export const dynamic = 'force-dynamic';

export const registerImageDetailOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/images/{id}',
    tags: ['图床管理'],
    summary: '获取原始图片内容',
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'image/*': {
            schema: {
              type: 'string',
              format: 'binary',
            },
          },
        },
      },
      404: {
        description: '图片不存在',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/images/{id}',
    tags: ['图床管理'],
    summary: '重命名图片',
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: imageRenameRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: imageAssetWithUrlsSchema,
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
      404: {
        description: '图片不存在',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '重命名失败',
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
    path: '/api/images/{id}',
    tags: ['图床管理'],
    summary: '删除单张图片',
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: '删除成功',
        content: {
          'application/json': {
            schema: deletedByIdResponseSchema,
          },
        },
      },
      404: {
        description: '图片不存在',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '删除失败',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });
});

registerImageDetailOpenApi();

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
      imageUrl: `/api/images/${image.id}`,
      pageUrl: image.pageId ? `/api/pages/${image.pageId}` : null,
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
