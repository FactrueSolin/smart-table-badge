export type ImageGenerationProviderName = 'modelscope';

export type ImageGenerationMode = 'text_to_image';

export type ImageGenerationJobStatus =
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'canceled'
  | 'import_failed';

export type ImageGenerationOutputStatus = 'pending_import' | 'imported' | 'import_failed';

export type ImageGenerationEventType =
  | 'job_created'
  | 'job_submitted'
  | 'job_processing'
  | 'job_succeeded'
  | 'job_failed'
  | 'job_canceled'
  | 'job_import_failed'
  | 'job_sync_failed'
  | 'job_timed_out'
  | 'job_polled';

export interface ImageGenerationCreateInput {
  name: string;
  mode: ImageGenerationMode;
  prompt: string;
  negativePrompt?: string;
  model: string;
  size?: string;
  seed?: number;
  steps?: number;
  guidance?: number;
}

export interface ImageGenerationListQuery {
  status?: ImageGenerationJobStatus;
  provider?: ImageGenerationProviderName;
  model?: string;
  cursor?: string;
  limit: number;
}

export interface ImageGenerationJobOutput {
  id: string;
  outputIndex: number;
  remoteUrl: string;
  remoteUrlHash: string;
  status: ImageGenerationOutputStatus;
  imageAssetId: string | null;
  pageId: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageGenerationJobEvent {
  id: string;
  type: ImageGenerationEventType;
  status: ImageGenerationJobStatus;
  reason: string | null;
  message: string | null;
  createdAt: string;
}

export interface ImageGenerationJobRecord {
  id: string;
  provider: ImageGenerationProviderName;
  mode: ImageGenerationMode;
  status: ImageGenerationJobStatus;
  name: string;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  size: string | null;
  seed: number | null;
  steps: number | null;
  guidance: number | null;
  remoteTaskId: string | null;
  remoteRequestId: string | null;
  statusReason: string | null;
  errorMessage: string | null;
  syncAttempts: number;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  submittedAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  providerRequestPayload: Record<string, unknown> | null;
  providerResponsePayload: Record<string, unknown> | null;
  outputs: ImageGenerationJobOutput[];
  events: ImageGenerationJobEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ImageGenerationJobStore {
  jobs: ImageGenerationJobRecord[];
}

export interface ImageGenerationJobSummary {
  id: string;
  provider: ImageGenerationProviderName;
  mode: ImageGenerationMode;
  status: ImageGenerationJobStatus;
  name: string;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  size: string | null;
  seed: number | null;
  steps: number | null;
  guidance: number | null;
  remoteTaskId: string | null;
  statusReason: string | null;
  errorMessage: string | null;
  outputs: ImageGenerationJobOutput[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
}

export interface ImageGenerationJobDetail extends ImageGenerationJobSummary {
  remoteRequestId: string | null;
  syncAttempts: number;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  processingStartedAt: string | null;
  events: ImageGenerationJobEvent[];
}

export interface ImageGenerationListResult {
  items: ImageGenerationJobSummary[];
  nextCursor: string | null;
}

export interface ImageGenerationSyncDueResult {
  picked: number;
  processed: number;
  succeeded: number;
  failed: number;
}
