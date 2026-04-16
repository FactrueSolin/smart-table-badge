import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { successResponseSchema } from '@/lib/openapi/schemas/common';

export const registerAuthLogoutOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'post',
    path: '/api/auth/logout',
    tags: ['认证'],
    summary: '退出登录',
    responses: {
      200: {
        description: '退出成功',
        content: {
          'application/json': {
            schema: successResponseSchema,
          },
        },
      },
    },
  });
});

registerAuthLogoutOpenApi();

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
