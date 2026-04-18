import { randomBytes } from 'node:crypto';

export type AiImageErrorCode =
  | 'AI_IMAGE_INVALID_INPUT'
  | 'AI_IMAGE_MODEL_NOT_ALLOWED'
  | 'AI_IMAGE_SIZE_NOT_ALLOWED'
  | 'AI_IMAGE_JOB_NOT_FOUND'
  | 'AI_IMAGE_JOB_STATE_CONFLICT'
  | 'AI_IMAGE_PROVIDER_SUBMIT_FAILED'
  | 'AI_IMAGE_PROVIDER_POLL_FAILED'
  | 'AI_IMAGE_PROVIDER_TIMEOUT'
  | 'AI_IMAGE_IMPORT_FAILED'
  | 'AI_IMAGE_UNAUTHORIZED'
  | 'AI_IMAGE_IDEMPOTENCY_CONFLICT';

export class AiImageError extends Error {
  readonly code: AiImageErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: AiImageErrorCode, message: string, status: number, retryable = false) {
    super(message);
    this.name = 'AiImageError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isAiImageError(error: unknown): error is AiImageError {
  return error instanceof AiImageError;
}

export interface AiImageErrorResponseBody {
  error: {
    code: AiImageErrorCode;
    message: string;
    retryable: boolean;
  };
  requestId: string;
}

export function toAiImageErrorResponse(error: unknown, requestId: string): {
  body: AiImageErrorResponseBody;
  status: number;
} {
  if (isAiImageError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        requestId,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'AI_IMAGE_PROVIDER_POLL_FAILED',
        message: '服务内部错误',
        retryable: false,
      },
      requestId,
    },
  };
}

export function createAiImageRequestId(): string {
  return `req_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;
}
