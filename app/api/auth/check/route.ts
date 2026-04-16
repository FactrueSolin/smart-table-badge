import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { authCheckResponseSchema } from '@/lib/openapi/schemas/auth';

export const registerAuthCheckOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/auth/check',
    tags: ['认证'],
    summary: '检查认证状态',
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: authCheckResponseSchema,
          },
        },
      },
    },
  });
});

registerAuthCheckOpenApi();

export async function GET() {
  const authed = await isAuthenticated();
  return NextResponse.json({ authenticated: authed });
}
