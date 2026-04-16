import { z } from '@/lib/openapi/registry';

export const errorResponseSchema = z.object({
  error: z.string().openapi({ description: '错误信息' }),
}).openapi('ErrorResponse');

export const successResponseSchema = z.object({
  success: z.boolean().openapi({ description: '操作是否成功' }),
}).openapi('SuccessResponse');

export const idParamSchema = z.object({
  id: z.string().min(1).openapi({ description: '资源 ID', example: '1776050757560-2g19q1' }),
});

export const deletedByIdResponseSchema = z.object({
  deleted: z.literal(true).openapi({ description: '删除成功标记' }),
  id: z.string().openapi({ description: '已删除资源 ID' }),
}).openapi('DeletedByIdResponse');

export const deletedIdsResponseSchema = z.object({
  deletedIds: z.array(z.string()).openapi({ description: '已删除图片 ID 列表' }),
}).openapi('DeletedIdsResponse');
