import { z } from '@/lib/openapi/registry';

export const aiImageProviderSchema = z.enum(['modelscope']).openapi('AiImageProvider');

export const aiImageModeSchema = z.enum(['text_to_image']).openapi('AiImageMode');

export const aiImageJobStatusSchema = z
  .enum(['queued', 'submitted', 'processing', 'succeeded', 'failed', 'timed_out', 'canceled', 'import_failed'])
  .openapi('AiImageJobStatus');

export const aiImageOutputStatusSchema = z
  .enum(['pending_import', 'imported', 'import_failed'])
  .openapi('AiImageOutputStatus');

export const aiImageEventTypeSchema = z
  .enum([
    'job_created',
    'job_submitted',
    'job_processing',
    'job_succeeded',
    'job_failed',
    'job_canceled',
    'job_import_failed',
    'job_sync_failed',
    'job_timed_out',
    'job_polled',
  ])
  .openapi('AiImageEventType');

export const aiImageErrorCodeSchema = z
  .enum([
    'AI_IMAGE_INVALID_INPUT',
    'AI_IMAGE_MODEL_NOT_ALLOWED',
    'AI_IMAGE_SIZE_NOT_ALLOWED',
    'AI_IMAGE_JOB_NOT_FOUND',
    'AI_IMAGE_JOB_STATE_CONFLICT',
    'AI_IMAGE_PROVIDER_SUBMIT_FAILED',
    'AI_IMAGE_PROVIDER_POLL_FAILED',
    'AI_IMAGE_PROVIDER_TIMEOUT',
    'AI_IMAGE_IMPORT_FAILED',
    'AI_IMAGE_UNAUTHORIZED',
    'AI_IMAGE_IDEMPOTENCY_CONFLICT',
  ])
  .openapi('AiImageErrorCode');

export const aiImageErrorResponseSchema = z
  .object({
    error: z.object({
      code: aiImageErrorCodeSchema,
      message: z.string(),
      retryable: z.boolean(),
    }),
    requestId: z.string(),
  })
  .openapi('AiImageErrorResponse');

export const aiImageJobOutputSchema = z
  .object({
    id: z.string(),
    outputIndex: z.number().int().nonnegative(),
    remoteUrl: z.string(),
    status: aiImageOutputStatusSchema,
    imageAssetId: z.string().nullable(),
    pageId: z.string().nullable(),
    imageUrl: z.string().nullable(),
    pageUrl: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('AiImageJobOutput');

export const aiImageJobEventSchema = z
  .object({
    id: z.string(),
    type: aiImageEventTypeSchema,
    status: aiImageJobStatusSchema,
    reason: z.string().nullable(),
    message: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('AiImageJobEvent');

export const aiImageJobSummarySchema = z
  .object({
    id: z.string(),
    provider: aiImageProviderSchema,
    mode: aiImageModeSchema,
    status: aiImageJobStatusSchema,
    name: z.string(),
    prompt: z.string(),
    negativePrompt: z.string().nullable(),
    model: z.string(),
    size: z.string().nullable(),
    seed: z.number().int().nullable(),
    steps: z.number().int().nullable(),
    guidance: z.number().nullable(),
    remoteTaskId: z.string().nullable(),
    statusReason: z.string().nullable(),
    errorMessage: z.string().nullable(),
    outputs: z.array(aiImageJobOutputSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    submittedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
  })
  .openapi('AiImageJobSummary');

export const aiImageJobDetailSchema = aiImageJobSummarySchema
  .extend({
    remoteRequestId: z.string().nullable(),
    syncAttempts: z.number().int().nonnegative(),
    lastSyncedAt: z.string().datetime().nullable(),
    nextSyncAt: z.string().datetime().nullable(),
    processingStartedAt: z.string().datetime().nullable(),
    events: z.array(aiImageJobEventSchema),
  })
  .openapi('AiImageJobDetail');

export const aiImageCreateRequestSchema = z
  .object({
    name: z.string().min(1).max(200),
    mode: z.literal('text_to_image'),
    prompt: z.string().min(1).max(4000),
    negativePrompt: z.string().max(4000).optional(),
    model: z.string().min(1),
    size: z.string().optional(),
    seed: z.number().int().min(0).max(2147483647).optional(),
    steps: z.number().int().min(1).max(100).optional(),
    guidance: z.number().min(0).max(20).optional(),
  })
  .openapi('AiImageCreateRequest');

export const aiImageJobResponseSchema = z
  .object({
    job: aiImageJobDetailSchema,
  })
  .openapi('AiImageJobResponse');

export const aiImageJobListResponseSchema = z
  .object({
    items: z.array(aiImageJobSummarySchema),
    nextCursor: z.string().nullable(),
  })
  .openapi('AiImageJobListResponse');

export const aiImageJobListQuerySchema = z
  .object({
    status: aiImageJobStatusSchema.optional(),
    provider: aiImageProviderSchema.optional(),
    model: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .openapi('AiImageJobListQuery');

export const aiImageJobDetailQuerySchema = z
  .object({
    sync: z.enum(['true', 'false']).optional(),
  })
  .openapi('AiImageJobDetailQuery');

export const aiImageJobIdParamSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('AiImageJobIdParam');

export const aiImageSyncDueRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
  })
  .openapi('AiImageSyncDueRequest');

export const aiImageSyncDueResponseSchema = z
  .object({
    picked: z.number().int().nonnegative(),
    processed: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .openapi('AiImageSyncDueResponse');
