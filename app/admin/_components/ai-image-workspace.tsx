'use client';

import Image from 'next/image';
import {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from 'react';

import type { ImageAsset } from './types';

type ImageJobStatus =
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'canceled'
  | 'import_failed';

type JobFilterStatus = 'all' | ImageJobStatus;

type OutputStatus = 'pending_import' | 'imported' | 'import_failed';

type ImageJobEventType =
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

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

type RealtimeState = 'connecting' | 'connected' | 'disconnected';

interface AiImageJobOutput {
  id: string;
  outputIndex: number;
  remoteUrl: string;
  status: OutputStatus;
  imageAssetId: string | null;
  pageId: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AiImageJobEvent {
  id: string;
  type: ImageJobEventType;
  status: ImageJobStatus;
  reason: string | null;
  message: string | null;
  createdAt: string;
}

interface AiImageJobSummary {
  id: string;
  status: ImageJobStatus;
  name: string;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  size: string | null;
  seed: number | null;
  steps: number | null;
  guidance: number | null;
  statusReason: string | null;
  errorMessage: string | null;
  outputs: AiImageJobOutput[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
}

interface AiImageJobDetail extends AiImageJobSummary {
  syncAttempts: number;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  processingStartedAt: string | null;
  events: AiImageJobEvent[];
}

interface AiImageJobListResponse {
  items: AiImageJobSummary[];
  nextCursor: string | null;
}

interface AiImageJobResponse {
  job: AiImageJobDetail;
}

interface FormState {
  name: string;
  prompt: string;
  negativePrompt: string;
  model: string;
  size: string;
  seed: string;
  steps: string;
  guidance: string;
}

interface FormErrors {
  name?: string;
  prompt?: string;
  seed?: string;
  steps?: string;
  guidance?: string;
}

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

interface TimelineItem {
  key: string;
  label: string;
  description: string;
  at: string;
}

interface JobChangedEvent {
  jobId: string;
  status: ImageJobStatus;
  event: ImageJobEventType;
  timestamp: number;
  imageAssetIds: string[];
  pageIds: string[];
}

interface ContentChangedEvent {
  action?: string;
  type?: string;
  timestamp?: number;
}

interface AIImageWorkspaceProps {
  images: ImageAsset[];
  onViewAssets?: () => void;
  onAssetsChanged?: () => void | Promise<void>;
}

const modelOptions = [
  {
    value: 'Qwen/Qwen-Image',
    label: 'Qwen-Image',
    description: '当前阶段仅开放一个可用模型，后端会继续校验模型白名单。',
  },
];

const sizeOptions = ['768x768', '1024x1024', '1328x1328'];

const statusMeta: Record<
  ImageJobStatus,
  {
    label: string;
    accent: string;
    chip: string;
    description: string;
  }
> = {
  queued: {
    label: '排队中',
    accent: 'text-slate-600 dark:text-slate-300',
    chip:
      'bg-slate-900/5 text-slate-600 ring-1 ring-inset ring-slate-900/10 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
    description: '任务已创建，等待提交到生成服务。',
  },
  submitted: {
    label: '已提交',
    accent: 'text-sky-600 dark:text-sky-300',
    chip:
      'bg-sky-500/12 text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:bg-sky-400/12 dark:text-sky-300 dark:ring-sky-300/20',
    description: '已发送到生成服务，系统会继续自动追踪。',
  },
  processing: {
    label: '生成中',
    accent: 'text-cyan-600 dark:text-cyan-300',
    chip:
      'bg-cyan-500/12 text-cyan-700 ring-1 ring-inset ring-cyan-500/20 dark:bg-cyan-400/12 dark:text-cyan-300 dark:ring-cyan-300/20',
    description: '正在生成图片，结果会自动进入图库。',
  },
  succeeded: {
    label: '已完成',
    accent: 'text-emerald-600 dark:text-emerald-300',
    chip:
      'bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-300/20',
    description: '图片已生成并导入图库，可直接复制原图链接或打开展示页。',
  },
  failed: {
    label: '生成失败',
    accent: 'text-rose-600 dark:text-rose-300',
    chip:
      'bg-rose-500/12 text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:bg-rose-400/12 dark:text-rose-300 dark:ring-rose-300/20',
    description: '服务返回失败，请调整参数后重试。',
  },
  timed_out: {
    label: '已超时',
    accent: 'text-amber-600 dark:text-amber-300',
    chip:
      'bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-400/12 dark:text-amber-300 dark:ring-amber-300/20',
    description: '生成耗时过长，系统已停止等待。',
  },
  canceled: {
    label: '已取消',
    accent: 'text-zinc-500 dark:text-zinc-300',
    chip:
      'bg-zinc-500/10 text-zinc-600 ring-1 ring-inset ring-zinc-500/15 dark:bg-zinc-400/10 dark:text-zinc-300 dark:ring-white/10',
    description: '任务已取消，不再继续处理。',
  },
  import_failed: {
    label: '导入失败',
    accent: 'text-orange-600 dark:text-orange-300',
    chip:
      'bg-orange-500/12 text-orange-700 ring-1 ring-inset ring-orange-500/20 dark:bg-orange-400/12 dark:text-orange-300 dark:ring-orange-300/20',
    description: '图片已生成，但未成功导入图库。',
  },
};

const noticeToneClass: Record<NoticeTone, string> = {
  info:
    'border-sky-200/80 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200',
  success:
    'border-emerald-200/80 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  warning:
    'border-amber-200/80 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  danger:
    'border-rose-200/80 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200',
};

const defaultFormState: FormState = {
  name: '',
  prompt: '',
  negativePrompt: '',
  model: modelOptions[0]?.value ?? '',
  size: sizeOptions[1] ?? sizeOptions[0] ?? '',
  seed: '',
  steps: '30',
  guidance: '3.5',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractApiErrorMessage(value: unknown, fallback: string): string {
  if (isRecord(value)) {
    const error = value.error;

    if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    if (typeof value.error === 'string' && value.error.trim()) {
      return value.error.trim();
    }
  }

  return fallback;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, fallbackMessage));
  }

  return payload as T;
}

function buildSuggestedName(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  return normalized.slice(0, 18);
}

function formatTime(value: string | null): string {
  if (!value) {
    return '未记录';
  }

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPromptExcerpt(prompt: string, limit = 96): string {
  return prompt.length > limit ? `${prompt.slice(0, limit)}...` : prompt;
}

function formatCountLabel(value: number, unit: string): string {
  return `${value} ${unit}`;
}

function isTerminalStatus(status: ImageJobStatus): boolean {
  return ['succeeded', 'failed', 'timed_out', 'canceled', 'import_failed'].includes(status);
}

function isJobDetail(job: AiImageJobSummary | AiImageJobDetail): job is AiImageJobDetail {
  return 'events' in job;
}

function sortJobsByCreatedAt<T extends { createdAt: string }>(jobs: T[]): T[] {
  return [...jobs].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ));
}

function sortOutputsByIndex(outputs: AiImageJobOutput[]): AiImageJobOutput[] {
  return [...outputs].sort((left, right) => left.outputIndex - right.outputIndex);
}

function getOutputSummary(job: AiImageJobSummary): string {
  const importedCount = job.outputs.filter((output) => output.status === 'imported').length;
  const pendingCount = job.outputs.filter((output) => output.status === 'pending_import').length;
  const failedCount = job.outputs.filter((output) => output.status === 'import_failed').length;

  if (importedCount > 0) {
    return `${importedCount} 张已入库`;
  }

  if (pendingCount > 0) {
    return `${pendingCount} 张待导入`;
  }

  if (failedCount > 0) {
    return `${failedCount} 张导入失败`;
  }

  return '0 张结果';
}

function getReadableJobReason(job: AiImageJobSummary): string | null {
  if (job.errorMessage?.trim()) {
    return job.errorMessage.trim();
  }

  if (job.statusReason?.trim()) {
    return job.statusReason.trim();
  }

  return null;
}

function getPromptExample(): string {
  return '电商护肤产品海报，透明亚克力展台，柔和边缘光，青绿色与香槟金配色，杂志封面感';
}

function toAbsoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (typeof window === 'undefined') {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return Number.parseInt(trimmed, 10);
}

function parseOptionalFloat(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return Number.parseFloat(trimmed);
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = '请补充任务名称。';
  } else if (form.name.trim().length > 200) {
    errors.name = '任务名称不能超过 200 个字符。';
  }

  if (!form.prompt.trim()) {
    errors.prompt = '请先输入 Prompt。';
  } else if (form.prompt.trim().length > 4000) {
    errors.prompt = 'Prompt 不能超过 4000 个字符。';
  }

  if (form.seed.trim() && !/^\d+$/.test(form.seed.trim())) {
    errors.seed = 'Seed 必须是非负整数。';
  }

  if (form.steps.trim() && !/^\d+$/.test(form.steps.trim())) {
    errors.steps = 'Steps 必须是整数。';
  }

  if (form.guidance.trim()) {
    const guidance = Number.parseFloat(form.guidance.trim());

    if (!Number.isFinite(guidance)) {
      errors.guidance = 'Guidance 必须是数字。';
    }
  }

  return errors;
}

function hasFormErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((value) => typeof value === 'string' && value.length > 0);
}

function parseSsePayload<T>(raw: string): T | null {
  try {
    const firstPass = JSON.parse(raw) as unknown;

    if (typeof firstPass === 'string') {
      return JSON.parse(firstPass) as T;
    }

    return firstPass as T;
  } catch {
    return null;
  }
}

function buildTimeline(job: AiImageJobSummary | AiImageJobDetail): TimelineItem[] {
  const eventFallbackMeta: Record<
    ImageJobEventType,
    {
      label: string;
      description: string;
    }
  > = {
    job_created: {
      label: '已创建',
      description: '任务已进入系统，等待提交到生成服务。',
    },
    job_submitted: {
      label: '已提交',
      description: '参数已发送到生成服务。',
    },
    job_processing: {
      label: '处理中',
      description: '系统正在生成图片并持续追踪进度。',
    },
    job_succeeded: {
      label: '已完成',
      description: '图片已生成并导入本地图库。',
    },
    job_failed: {
      label: '生成失败',
      description: '服务返回失败，请调整参数后重试。',
    },
    job_canceled: {
      label: '已取消',
      description: '任务已取消，不再继续处理。',
    },
    job_import_failed: {
      label: '导入失败',
      description: '图片已生成，但未成功导入本地图库。',
    },
    job_sync_failed: {
      label: '同步异常',
      description: '同步远端任务状态时发生异常。',
    },
    job_timed_out: {
      label: '已超时',
      description: '生成耗时过长，系统已停止等待。',
    },
    job_polled: {
      label: '状态查询',
      description: '系统完成了一次状态同步。',
    },
  };

  if (isJobDetail(job) && job.events.length > 0) {
    return [...job.events]
      .filter((event) => event.type !== 'job_polled')
      .sort((left, right) => (
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      ))
      .map((event) => ({
        key: event.id,
        label: eventFallbackMeta[event.type].label,
        description:
          event.message?.trim()
          || event.reason?.trim()
          || eventFallbackMeta[event.type].description,
        at: event.createdAt,
      }));
  }

  const fallbackTimeline: TimelineItem[] = [
    {
      key: `${job.id}-created`,
      label: '已创建',
      description: '任务已进入系统，等待提交到生成服务。',
      at: job.createdAt,
    },
  ];

  if (job.submittedAt) {
    fallbackTimeline.push({
      key: `${job.id}-submitted`,
      label: '已提交',
      description: '参数已发送到生成服务。',
      at: job.submittedAt,
    });
  }

  if (isJobDetail(job) && job.processingStartedAt) {
    fallbackTimeline.push({
      key: `${job.id}-processing`,
      label: '处理中',
      description: '系统正在生成图片并持续追踪进度。',
      at: job.processingStartedAt,
    });
  }

  if (job.completedAt) {
    fallbackTimeline.push({
      key: `${job.id}-completed`,
      label: statusMeta[job.status].label,
      description: getReadableJobReason(job) ?? statusMeta[job.status].description,
      at: job.completedAt,
    });
  }

  return fallbackTimeline;
}

function getCopyLabel(baseLabel: string, copiedLabel: string, active: boolean): string {
  return active ? copiedLabel : baseLabel;
}

function NoticeBanner({ notice }: { notice: NoticeState }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${noticeToneClass[notice.tone]}`}>
      {notice.text}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.6)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/35">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{hint}</p>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{message}</p>;
}

function JobListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-[26px] border border-zinc-200 bg-zinc-50/80 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/55"
        >
          <div className="h-5 w-48 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-3 h-4 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-5/6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-8 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OutputThumbnail({
  output,
  jobName,
}: {
  output: AiImageJobOutput;
  jobName: string;
}) {
  const src = output.imageUrl ?? output.remoteUrl;

  if (!src) {
    return (
      <div className="flex h-44 items-center justify-center rounded-[22px] border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        暂无可展示的结果
      </div>
    );
  }

  return (
    <div className="relative h-44 overflow-hidden rounded-[22px] border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      <Image
        src={src}
        alt={`${jobName} 结果 ${output.outputIndex + 1}`}
        fill
        unoptimized
        className="object-cover"
      />
    </div>
  );
}

export default function AIImageWorkspace({
  images,
  onViewAssets,
  onAssetsChanged,
}: AIImageWorkspaceProps) {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [nameCustomized, setNameCustomized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AiImageJobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobFilterStatus>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<AiImageJobDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [refreshingJobIds, setRefreshingJobIds] = useState<string[]>([]);
  const [cancelingJobIds, setCancelingJobIds] = useState<string[]>([]);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting');

  const deferredSearchText = useDeferredValue(searchText);

  useEffect(() => {
    if (!highlightedJobId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedJobId(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [highlightedJobId]);

  useEffect(() => {
    if (!copiedKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedKey(null);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const mergeJobIntoList = useCallback((job: AiImageJobSummary | AiImageJobDetail) => {
    setJobs((current) => sortJobsByCreatedAt([
      job,
      ...current.filter((item) => item.id !== job.id),
    ]).slice(0, 20));
  }, []);

  const loadJobs = useCallback(async (
    filter: JobFilterStatus,
    options?: { silent?: boolean },
  ) => {
    if (!options?.silent) {
      setJobsLoading(true);
    }

    setJobsError(null);

    try {
      const params = new URLSearchParams({ limit: '20' });

      if (filter !== 'all') {
        params.set('status', filter);
      }

      const response = await fetch(`/api/ai/images/jobs?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await parseApiResponse<AiImageJobListResponse>(response, '任务列表加载失败');

      setJobs(sortJobsByCreatedAt(data.items));
    } catch (error) {
      setJobsError(
        error instanceof Error ? error.message : '任务列表加载失败，请稍后重试。',
      );
    } finally {
      if (!options?.silent) {
        setJobsLoading(false);
      }
    }
  }, []);

  const loadJobDetail = useCallback(async (
    jobId: string,
    options?: {
      sync?: boolean;
      showLoader?: boolean;
    },
  ) => {
    const sync = options?.sync ?? false;
    const showLoader = options?.showLoader ?? true;

    if (showLoader && selectedJobId === jobId) {
      setDrawerLoading(true);
      setDrawerError(null);
    }

    if (sync) {
      setRefreshingJobIds((current) => (
        current.includes(jobId) ? current : [...current, jobId]
      ));
    }

    try {
      const response = await fetch(`/api/ai/images/jobs/${jobId}?sync=${sync ? 'true' : 'false'}`, {
        cache: 'no-store',
      });
      const data = await parseApiResponse<AiImageJobResponse>(response, '任务详情加载失败');

      mergeJobIntoList(data.job);

      if (selectedJobId === jobId) {
        setSelectedJobDetail(data.job);
      }

      if (sync) {
        if (data.job.status === 'succeeded') {
          setNotice({
            tone: 'success',
            text: '图片已生成并导入图库，可直接复制原图链接或打开展示页。',
          });
          void onAssetsChanged?.();
        } else {
          setNotice({
            tone: 'info',
            text: '任务状态已刷新。实时更新不可用时，也可以继续手动刷新。',
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '任务详情加载失败，请稍后重试。';

      if (selectedJobId === jobId) {
        setDrawerError(message);
      }

      if (sync) {
        setNotice({
          tone: 'warning',
          text: message,
        });
      }
    } finally {
      if (showLoader && selectedJobId === jobId) {
        setDrawerLoading(false);
      }

      if (sync) {
        setRefreshingJobIds((current) => current.filter((item) => item !== jobId));
      }
    }
  }, [mergeJobIntoList, onAssetsChanged, selectedJobId]);

  const handleAiJobChanged = useCallback(async (event: MessageEvent<string>) => {
    const payload = parseSsePayload<JobChangedEvent>(event.data);

    if (!payload) {
      return;
    }

    setRealtimeState('connected');
    void loadJobs(statusFilter, { silent: true });

    if (selectedJobId === payload.jobId) {
      void loadJobDetail(payload.jobId, { sync: false, showLoader: false });
    }

    if (payload.imageAssetIds.length > 0 || payload.pageIds.length > 0) {
      void onAssetsChanged?.();
    }

    if (payload.status === 'succeeded') {
      setNotice({
        tone: 'success',
        text: '图片已生成并导入图库。',
      });
    }
  }, [loadJobDetail, loadJobs, onAssetsChanged, selectedJobId, statusFilter]);

  const handleContentChanged = useCallback(async (event: MessageEvent<string>) => {
    const payload = parseSsePayload<ContentChangedEvent>(event.data);

    if (payload?.type === 'image' || payload?.action === 'upload') {
      void onAssetsChanged?.();
    }
  }, [onAssetsChanged]);

  useEffect(() => {
    void loadJobs(statusFilter);
  }, [loadJobs, statusFilter]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      setDrawerError(null);
      setDrawerLoading(false);
      return;
    }

    void loadJobDetail(selectedJobId, { sync: false, showLoader: true });
  }, [loadJobDetail, selectedJobId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      setRealtimeState('disconnected');
      return;
    }

    const eventSource = new window.EventSource('/api/sse');

    eventSource.addEventListener('connected', () => {
      setRealtimeState('connected');
    });
    eventSource.addEventListener('ai-image-job-changed', (event) => {
      void handleAiJobChanged(event as MessageEvent<string>);
    });
    eventSource.addEventListener('content-changed', (event) => {
      void handleContentChanged(event as MessageEvent<string>);
    });
    eventSource.onerror = () => {
      setRealtimeState('disconnected');
    };

    return () => {
      eventSource.close();
    };
  }, [handleAiJobChanged, handleContentChanged]);

  const filteredJobs = jobs.filter((job) => {
    const searchValue = deferredSearchText.trim().toLowerCase();
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesSearch =
      searchValue.length === 0
      || `${job.name} ${job.prompt} ${job.model}`.toLowerCase().includes(searchValue);

    return matchesStatus && matchesSearch;
  });

  const selectedJobSummary = selectedJobId
    ? jobs.find((job) => job.id === selectedJobId) ?? null
    : null;
  const selectedJob =
    selectedJobDetail && selectedJobDetail.id === selectedJobId
      ? selectedJobDetail
      : selectedJobSummary;
  const timeline = selectedJob ? buildTimeline(selectedJob) : [];
  const recentAiAssets = images.filter((image) => image.source === 'ai_generated').slice(0, 3);

  const succeededCount = jobs.filter((job) => job.status === 'succeeded').length;
  const processingCount = jobs.filter((job) => ['queued', 'submitted', 'processing'].includes(job.status)).length;
  const importedOutputs = jobs.reduce((count, job) => (
    count + job.outputs.filter((output) => output.status === 'imported').length
  ), 0);

  async function handleCopy(value: string, key: string) {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(toAbsoluteUrl(value));
    setCopiedKey(key);
  }

  async function handleSubmit() {
    const validationErrors = validateForm(form);
    setFormErrors(validationErrors);
    setSubmitError(null);

    if (hasFormErrors(validationErrors)) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/ai/images/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': createIdempotencyKey(),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          mode: 'text_to_image',
          prompt: form.prompt.trim(),
          negativePrompt: form.negativePrompt.trim() || undefined,
          model: form.model,
          size: form.size,
          seed: parseOptionalInteger(form.seed),
          steps: parseOptionalInteger(form.steps),
          guidance: parseOptionalFloat(form.guidance),
        }),
      });
      const data = await parseApiResponse<AiImageJobResponse>(response, '任务创建失败');

      mergeJobIntoList(data.job);
      setHighlightedJobId(data.job.id);
      setNotice({
        tone: 'success',
        text: '任务已提交，正在生成中。',
      });
      setSearchText('');

      if (statusFilter !== 'all') {
        setStatusFilter('all');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '任务创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefreshJob(jobId: string) {
    await loadJobDetail(jobId, {
      sync: true,
      showLoader: selectedJobId === jobId,
    });
  }

  async function handleCancelJob(job: AiImageJobSummary) {
    if (!window.confirm('取消后任务不会继续推进，已生成结果也不会再导入。')) {
      return;
    }

    setCancelingJobIds((current) => (
      current.includes(job.id) ? current : [...current, job.id]
    ));

    try {
      const response = await fetch(`/api/ai/images/jobs/${job.id}/cancel`, {
        method: 'POST',
      });
      const data = await parseApiResponse<AiImageJobResponse>(response, '取消任务失败');

      mergeJobIntoList(data.job);

      if (selectedJobId === job.id) {
        setSelectedJobDetail(data.job);
      }

      setNotice({
        tone: 'warning',
        text: '任务已取消，不再继续推进。',
      });
    } catch (error) {
      setNotice({
        tone: 'danger',
        text: error instanceof Error ? error.message : '取消任务失败，请稍后重试。',
      });
    } finally {
      setCancelingJobIds((current) => current.filter((item) => item !== job.id));
    }
  }

  function handleReuseJob(job: AiImageJobSummary) {
    setForm({
      name: job.name,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt ?? '',
      model: job.model,
      size: job.size ?? defaultFormState.size,
      seed: job.seed === null ? '' : String(job.seed),
      steps: job.steps === null ? '' : String(job.steps),
      guidance: job.guidance === null ? '' : String(job.guidance),
    });
    setFormErrors({});
    setSubmitError(null);
    setNameCustomized(true);
    setShowNegativePrompt(Boolean(job.negativePrompt));
    setShowAdvancedSettings(job.seed !== null || job.steps !== null || job.guidance !== null);
    setNotice({
      tone: 'info',
      text: `已带回“${job.name}”的参数，可以直接微调后再次生成。`,
    });
  }

  const realtimeChipClass =
    realtimeState === 'connected'
      ? 'border-emerald-200/80 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300'
      : realtimeState === 'connecting'
        ? 'border-sky-200/80 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300'
        : 'border-amber-200/80 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300';

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_32px_90px_-50px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_36%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(135deg,_rgba(248,250,252,0.92),_rgba(255,255,255,0.78))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_36%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(135deg,_rgba(24,24,27,0.98),_rgba(10,10,10,0.94))]" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium tracking-[0.18em] text-white dark:bg-white dark:text-zinc-950">
                  AI 生图工作台
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs ${realtimeChipClass}`}>
                  {realtimeState === 'connected'
                    ? '实时更新已连接'
                    : realtimeState === 'connecting'
                      ? '正在连接实时更新'
                      : '实时更新已断开'}
                </span>
              </div>
              <h3 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                在图床管理里完成 Prompt、任务追踪和结果回收。
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                当前版本围绕最小闭环展开：创建文生图任务、实时追踪异步状态、查看结果并回到现有图库继续使用。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricCard
                label="最近任务"
                value={formatCountLabel(jobs.length, '个')}
                hint="默认按创建时间倒序展示最近 20 条"
              />
              <MetricCard
                label="进行中"
                value={formatCountLabel(processingCount, '个')}
                hint="刷新页面后仍可继续追踪异步任务"
              />
              <MetricCard
                label="已入库结果"
                value={formatCountLabel(importedOutputs, '张')}
                hint={`${succeededCount} 个任务已成功完成`}
              />
            </div>
          </div>
        </div>
      </div>

      {realtimeState === 'disconnected' ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          实时更新已断开，可手动刷新任务状态。
        </div>
      ) : null}

      {notice ? <NoticeBanner notice={notice} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_24px_72px_-52px_rgba(15,23,42,0.55)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">创建任务</p>
              <h4 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">先把基础字段填完整</h4>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-400">
              <div>系统会自动附带幂等键</div>
              <div className="mt-1">避免双击重复创建任务</div>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">任务名称</span>
              <input
                aria-label="任务名称"
                value={form.name}
                onChange={(event) => {
                  setNameCustomized(true);
                  setFormErrors((current) => ({ ...current, name: undefined }));
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                placeholder="默认取 Prompt 前 12 到 20 个字符"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <FieldError message={formErrors.name} />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Prompt</span>
              <textarea
                aria-label="Prompt"
                value={form.prompt}
                onChange={(event) => {
                  const nextPrompt = event.target.value;
                  setFormErrors((current) => ({ ...current, prompt: undefined }));
                  setForm((current) => ({
                    ...current,
                    prompt: nextPrompt,
                    name: nameCustomized ? current.name : buildSuggestedName(nextPrompt),
                  }));
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                rows={7}
                placeholder="描述画面主体、风格、构图和光线，越具体越稳定"
                className="mt-2 w-full rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                支持 <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">Cmd/Ctrl + Enter</kbd> 提交
              </p>
              <FieldError message={formErrors.prompt} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">模型</span>
                {modelOptions.length === 1 ? (
                  <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    <p className="font-medium">{modelOptions[0].label}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {modelOptions[0].description}
                    </p>
                  </div>
                ) : (
                  <select
                    aria-label="模型"
                    value={form.model}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, model: event.target.value }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">尺寸</span>
                <select
                  aria-label="尺寸"
                  value={form.size}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, size: event.target.value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <button
                type="button"
                onClick={() => setShowNegativePrompt((current) => !current)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Negative Prompt</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {showNegativePrompt ? '收起' : '展开'}
                </span>
              </button>
              {showNegativePrompt ? (
                <div className="mt-4">
                  <textarea
                    aria-label="Negative Prompt"
                    value={form.negativePrompt}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, negativePrompt: event.target.value }));
                    }}
                    rows={4}
                    placeholder="用于排除低质、模糊、水印等问题，可留空"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-7 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings((current) => !current)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">高级参数</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {showAdvancedSettings ? '收起' : '展开'}
                </span>
              </button>
              {showAdvancedSettings ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Seed</span>
                    <input
                      aria-label="Seed"
                      value={form.seed}
                      onChange={(event) => {
                        setFormErrors((current) => ({ ...current, seed: undefined }));
                        setForm((current) => ({ ...current, seed: event.target.value }));
                      }}
                      placeholder="留空表示随机生成"
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <FieldError message={formErrors.seed} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Steps</span>
                    <input
                      aria-label="Steps"
                      value={form.steps}
                      onChange={(event) => {
                        setFormErrors((current) => ({ ...current, steps: undefined }));
                        setForm((current) => ({ ...current, steps: event.target.value }));
                      }}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <FieldError message={formErrors.steps} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Guidance</span>
                    <input
                      aria-label="Guidance"
                      value={form.guidance}
                      onChange={(event) => {
                        setFormErrors((current) => ({ ...current, guidance: undefined }));
                        setForm((current) => ({ ...current, guidance: event.target.value }));
                      }}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <FieldError message={formErrors.guidance} />
                  </label>
                </div>
              ) : null}
            </div>

            {submitError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                {submitError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-[22px] bg-zinc-950 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {submitting ? '提交中...' : '立即生成'}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_24px_72px_-52px_rgba(15,23,42,0.55)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">最近任务</p>
              <h4 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">保持创建与追踪同时可见</h4>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                aria-label="状态筛选"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as JobFilterStatus)}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="all">全部状态</option>
                {Object.entries(statusMeta).map(([status, meta]) => (
                  <option key={status} value={status}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="搜索任务"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索任务名称、Prompt 或模型"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {jobsLoading ? (
              <JobListSkeleton />
            ) : jobsError ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-500/10 px-6 py-6 dark:border-rose-400/20 dark:bg-rose-400/10">
                <p className="text-base font-semibold text-rose-700 dark:text-rose-200">任务列表加载失败</p>
                <p className="mt-2 text-sm text-rose-700/80 dark:text-rose-200/80">{jobsError}</p>
                <button
                  type="button"
                  onClick={() => {
                    void loadJobs(statusFilter);
                  }}
                  className="mt-4 rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/30 dark:bg-zinc-950 dark:text-rose-200"
                >
                  重新加载
                </button>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">还没有生成任务</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  输入提示词后，系统会异步生成图片并自动收录到图库。
                </p>
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                  示例 Prompt: {getPromptExample()}
                </p>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const meta = statusMeta[job.status];
                const running = ['queued', 'submitted', 'processing'].includes(job.status);
                const refreshing = refreshingJobIds.includes(job.id);
                const canceling = cancelingJobIds.includes(job.id);
                const reason = getReadableJobReason(job);

                return (
                  <article
                    key={job.id}
                    className={`rounded-[26px] border px-5 py-5 transition ${
                      highlightedJobId === job.id
                        ? 'border-sky-400 bg-sky-500/[0.08] shadow-[0_24px_60px_-40px_rgba(14,165,233,0.7)]'
                        : 'border-zinc-200 bg-zinc-50/85 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/55 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              startTransition(() => setSelectedJobId(job.id));
                            }}
                            className="text-left text-lg font-semibold text-zinc-950 dark:text-zinc-100"
                          >
                            {job.name}
                          </button>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.chip}`}>
                            {meta.label}
                          </span>
                          {running ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/50 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                              自动追踪中
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          {getPromptExcerpt(job.prompt)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{formatTime(job.createdAt)}</span>
                          <span>{job.model}</span>
                          <span>{job.size ?? '未指定尺寸'}</span>
                          <span>{getOutputSummary(job)}</span>
                        </div>
                        {reason ? (
                          <p className={`mt-3 text-sm ${meta.accent}`}>{reason}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(() => setSelectedJobId(job.id));
                          }}
                          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          查看详情
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleRefreshJob(job.id);
                          }}
                          disabled={refreshing}
                          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          {refreshing ? '刷新中...' : '刷新状态'}
                        </button>
                        {!isTerminalStatus(job.status) ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleCancelJob(job);
                            }}
                            disabled={canceling}
                            className="rounded-full border border-amber-300 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-400/20 dark:text-amber-300"
                          >
                            {canceling ? '取消中...' : '取消任务'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleReuseJob(job)}
                          className="rounded-full border border-sky-300 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-500/15 dark:border-sky-400/20 dark:text-sky-300"
                        >
                          复制参数再生成
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">图库回收预览</p>
              <h4 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">结果会回到现有图片资产链路</h4>
            </div>
            <button
              type="button"
              onClick={onViewAssets}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              在图库中查看
            </button>
          </div>
          {recentAiAssets.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-400">
              当前还没有 AI 入库图片。任务成功后，这里会出现带来源标识、生成时间和 Prompt 摘要的资产卡片。
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recentAiAssets.map((image) => (
                <div
                  key={image.id}
                  className="overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div className="relative h-40">
                    <Image
                      src={image.imageUrl}
                      alt={image.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{image.name}</p>
                      <span className="rounded-full border border-sky-300 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-700 dark:border-sky-400/20 dark:text-sky-300">
                        AI 生成
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {image.generationJobId ? `来源任务 ${image.generationJobId}` : '来源任务待记录'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {image.prompt ? getPromptExcerpt(image.prompt, 48) : '暂无 Prompt 摘要'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      生成时间 {formatTime(image.uploadedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">来源标识</p>
          <h4 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">图片资产里的 AI 结果表达</h4>
          <div className="mt-5 space-y-4">
            <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-sky-300 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700 dark:border-sky-400/20 dark:text-sky-300">
                  AI 生成
                </span>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">任务来源 / Prompt 摘要 / 生成时间</p>
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                在图库里也能反向追溯生成来源，不把 AI 结果当作普通上传图处理。
              </p>
            </div>
            <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  手动上传
                </span>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">保持当前资产列表心智不变</p>
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                AI 能力只是增强来源信息，不额外引入一套新的图库系统。
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedJob ? (
        <div className="fixed inset-0 z-30 bg-zinc-950/35 backdrop-blur-[2px]">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-white p-6 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)] dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-2xl font-semibold text-zinc-950 dark:text-white">{selectedJob.name}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta[selectedJob.status].chip}`}>
                    {statusMeta[selectedJob.status].label}
                  </span>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {statusMeta[selectedJob.status].description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedJobId(null);
                  setSelectedJobDetail(null);
                }}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                关闭
              </button>
            </div>

            {drawerError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                {drawerError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">基本信息</p>
                <dl className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <div className="flex items-center justify-between gap-4">
                    <dt>创建时间</dt>
                    <dd>{formatTime(selectedJob.createdAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>提交时间</dt>
                    <dd>{formatTime(selectedJob.submittedAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>完成时间</dt>
                    <dd>{formatTime(selectedJob.completedAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>模型 / 尺寸</dt>
                    <dd>{selectedJob.model} / {selectedJob.size ?? '未指定尺寸'}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">任务诊断</p>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {getReadableJobReason(selectedJob) ?? '当前任务没有额外错误说明。'}
                </p>
                {isJobDetail(selectedJob) ? (
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    最近同步：{formatTime(selectedJob.lastSyncedAt)}，共 {selectedJob.syncAttempts} 次
                  </div>
                ) : null}
              </div>
            </div>

            <section className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">状态时间线</p>
                  <h5 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">用户可追踪、可恢复</h5>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleRefreshJob(selectedJob.id);
                  }}
                  disabled={refreshingJobIds.includes(selectedJob.id)}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  {refreshingJobIds.includes(selectedJob.id) ? '刷新中...' : '刷新状态'}
                </button>
              </div>
              {drawerLoading && !selectedJobDetail ? (
                <div className="mt-5 space-y-3" aria-hidden="true">
                  <div className="h-5 w-1/3 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-5 w-2/3 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-5 w-1/2 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ) : (
                <>
                  <ol className="mt-5 space-y-4">
                    {timeline.map((item, index) => (
                      <li key={item.key} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-zinc-950 dark:bg-white" />
                          {index < timeline.length - 1 ? (
                            <span className="mt-2 h-full w-px bg-zinc-200 dark:bg-zinc-800" />
                          ) : null}
                        </div>
                        <div className="pb-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.label}</p>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatTime(item.at)}</span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {isJobDetail(selectedJob) ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                      最近同步：{formatTime(selectedJob.lastSyncedAt)}，共 {selectedJob.syncAttempts} 次
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <section className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">输出结果</p>
                  <h5 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">成功图像直接给到下游使用链路</h5>
                </div>
                {selectedJob.outputs.some((output) => output.status === 'imported') ? (
                  <button
                    type="button"
                    onClick={onViewAssets}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  >
                    在图库中查看
                  </button>
                ) : null}
              </div>

              {selectedJob.outputs.length === 0 ? (
                <div className="mt-5 rounded-[20px] border border-dashed border-zinc-300 bg-white px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                  当前任务还没有可展示的输出。生成成功后，缩略图、资产 ID、原图链接和展示页链接会统一出现在这里。
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {sortOutputsByIndex(selectedJob.outputs).map((output) => (
                    <div
                      key={output.id}
                      className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="p-4">
                        <OutputThumbnail output={output} jobName={selectedJob.name} />
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            结果 {output.outputIndex + 1}
                          </p>
                          <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            {output.status === 'imported'
                              ? '已入库'
                              : output.status === 'pending_import'
                                ? '待导入'
                                : '导入失败'}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                          <p>图片资产 ID: {output.imageAssetId ?? '未生成'}</p>
                          <p>展示页 ID: {output.pageId ?? '未生成'}</p>
                          {output.errorMessage ? (
                            <p className="text-rose-600 dark:text-rose-300">{output.errorMessage}</p>
                          ) : null}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(output.imageUrl ?? output.remoteUrl) ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleCopy(output.imageUrl ?? output.remoteUrl, `${output.id}-image`);
                              }}
                              className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                              {getCopyLabel(
                                '复制直链',
                                '已复制直链',
                                copiedKey === `${output.id}-image`,
                              )}
                            </button>
                          ) : null}
                          {output.pageUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleCopy(output.pageUrl ?? '', `${output.id}-page`);
                              }}
                              className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                              {getCopyLabel(
                                '复制展示页链接',
                                '已复制展示页链接',
                                copiedKey === `${output.id}-page`,
                              )}
                            </button>
                          ) : null}
                          {output.pageUrl ? (
                            <a
                              href={toAbsoluteUrl(output.pageUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-sky-300 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-sky-400/20 dark:text-sky-300"
                            >
                              打开展示页
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">参数快照</p>
              <h5 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">只展示业务字段，不暴露底层 Provider</h5>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Prompt</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{selectedJob.prompt}</dd>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Negative Prompt</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    {selectedJob.negativePrompt?.trim() || '未填写'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">模型</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{selectedJob.model}</dd>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">尺寸</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{selectedJob.size ?? '未指定'}</dd>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Seed</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    {selectedJob.seed === null ? '随机生成' : selectedJob.seed}
                  </dd>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Steps</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{selectedJob.steps ?? '未指定'}</dd>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:col-span-2">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Guidance</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{selectedJob.guidance ?? '未指定'}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
