import { z } from '@/lib/openapi/registry';

export const loginRequestSchema = z.object({
  password: z.string().min(1).openapi({ description: '管理密码' }),
}).openapi('LoginRequest');

export const authCheckResponseSchema = z.object({
  authenticated: z.boolean().openapi({ description: '当前是否已登录' }),
}).openapi('AuthCheckResponse');
