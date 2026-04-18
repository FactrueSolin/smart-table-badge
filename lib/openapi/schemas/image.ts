import { z } from '@/lib/openapi/registry';
import { pageInfoSchema } from '@/lib/openapi/schemas/page';

export const imageSortSchema = z.enum(['uploadedAt-desc', 'uploadedAt-asc']).openapi('ImageSort');

export const imageListQuerySchema = z.object({
  sort: imageSortSchema.optional().openapi({ description: '排序方式，默认按上传时间倒序' }),
}).openapi('ImageListQuery');

export const imageAssetSchema = z.object({
  id: z.string().openapi({ description: '图片唯一 ID' }),
  name: z.string().openapi({ description: '图片名称' }),
  filename: z.string().openapi({ description: '存储文件名' }),
  mimeType: z.string().openapi({ description: 'MIME 类型' }),
  size: z.number().int().nonnegative().openapi({ description: '文件大小，单位字节' }),
  uploadedAt: z.string().datetime().openapi({ description: '上传时间' }),
  updatedAt: z.string().datetime().openapi({ description: '更新时间' }),
  pageId: z.string().nullable().openapi({ description: '关联页面 ID' }),
  source: z.enum(['upload', 'ai_generated']).optional().openapi({ description: '图片来源' }),
  generationJobId: z.string().nullable().optional().openapi({ description: '来源 AI 生图任务 ID' }),
  generationOutputId: z.string().nullable().optional().openapi({ description: '来源 AI 生图输出 ID' }),
  generatorProvider: z.string().nullable().optional().openapi({ description: '生成提供方' }),
  generatorModel: z.string().nullable().optional().openapi({ description: '生成模型' }),
  prompt: z.string().nullable().optional().openapi({ description: '生成提示词快照' }),
  negativePrompt: z.string().nullable().optional().openapi({ description: '生成负向提示词快照' }),
}).openapi('ImageAssetBase');

export const imageAssetWithUrlsSchema = imageAssetSchema.extend({
  imageUrl: z.string().openapi({ description: '原图访问地址' }),
  pageUrl: z.string().nullable().openapi({ description: '关联页面访问地址' }),
}).openapi('ImageAsset');

export const imageListSchema = z.array(imageAssetWithUrlsSchema).openapi('ImageList');

export const imageUploadRequestSchema = z.object({
  file: z.string().openapi({ type: 'string', format: 'binary', description: '图片文件' }),
  name: z.string().optional().openapi({ description: '图片名称' }),
}).openapi('ImageUploadRequest');

export const imageUploadResponseSchema = z.object({
  image: imageAssetWithUrlsSchema,
  page: pageInfoSchema,
}).openapi('ImageUploadResponse');

export const imageRenameRequestSchema = z.object({
  name: z.string().min(1).openapi({ description: '新的图片名称' }),
}).openapi('ImageRenameRequest');

export const imageBatchDeleteRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).openapi({ description: '待删除图片 ID 列表' }),
}).openapi('ImageBatchDeleteRequest');
