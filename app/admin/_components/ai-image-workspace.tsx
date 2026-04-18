'use client';

import Image from 'next/image';
import { startTransition, useDeferredValue, useEffect, useState } from 'react';

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

type OutputStatus = 'ready' | 'pending' | 'failed';

interface JobTimelineItem {
  label: string;
  description: string;
  at: string;
}

interface JobOutput {
  id: string;
  outputIndex: number;
  status: OutputStatus;
  imageAssetId: string | null;
  pageId: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
  errorMessage: string | null;
  palette: [string, string, string];
}

interface AiImageJob {
  id: string;
  name: string;
  status: ImageJobStatus;
  prompt: string;
  negativePrompt: string;
  model: string;
  size: string;
  seed: string;
  steps: string;
  guidance: string;
  statusReason: string | null;
  errorMessage: string | null;
  createdAt: string;
  submittedAt: string | null;
  finishedAt: string | null;
  syncAttempts: number;
  lastSyncedAt: string | null;
  outputs: JobOutput[];
  timeline: JobTimelineItem[];
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

interface NoticeState {
  tone: 'info' | 'success' | 'warning';
  text: string;
}

interface AIImageWorkspaceProps {
  images: ImageAsset[];
  onViewAssets?: () => void;
}

const modelOptions = [
  {
    value: 'Qwen/Qwen-Image',
    label: 'Qwen-Image',
    description: '适合海报、KV 与写实风格的通用模型',
  },
];

const sizeOptions = [
  '1024x1024',
  '1216x832',
  '832x1216',
  '1536x1024',
];

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
    chip: 'bg-slate-900/5 text-slate-600 ring-1 ring-inset ring-slate-900/10 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
    description: '任务已创建，等待提交',
  },
  submitted: {
    label: '已提交',
    accent: 'text-sky-600 dark:text-sky-300',
    chip: 'bg-sky-500/12 text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:bg-sky-400/12 dark:text-sky-300 dark:ring-sky-300/20',
    description: '已发送到生成服务',
  },
  processing: {
    label: '生成中',
    accent: 'text-cyan-600 dark:text-cyan-300',
    chip: 'bg-cyan-500/12 text-cyan-700 ring-1 ring-inset ring-cyan-500/20 dark:bg-cyan-400/12 dark:text-cyan-300 dark:ring-cyan-300/20',
    description: '正在生成图片',
  },
  succeeded: {
    label: '已完成',
    accent: 'text-emerald-600 dark:text-emerald-300',
    chip: 'bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-300/20',
    description: '图片已生成并导入图库',
  },
  failed: {
    label: '生成失败',
    accent: 'text-rose-600 dark:text-rose-300',
    chip: 'bg-rose-500/12 text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:bg-rose-400/12 dark:text-rose-300 dark:ring-rose-300/20',
    description: '服务返回失败，请调整参数后重试',
  },
  timed_out: {
    label: '已超时',
    accent: 'text-amber-600 dark:text-amber-300',
    chip: 'bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-400/12 dark:text-amber-300 dark:ring-amber-300/20',
    description: '处理时间过长，系统已停止等待',
  },
  canceled: {
    label: '已取消',
    accent: 'text-zinc-500 dark:text-zinc-300',
    chip: 'bg-zinc-500/10 text-zinc-600 ring-1 ring-inset ring-zinc-500/15 dark:bg-zinc-400/10 dark:text-zinc-300 dark:ring-white/10',
    description: '任务已取消，不再继续处理',
  },
  import_failed: {
    label: '导入失败',
    accent: 'text-orange-600 dark:text-orange-300',
    chip: 'bg-orange-500/12 text-orange-700 ring-1 ring-inset ring-orange-500/20 dark:bg-orange-400/12 dark:text-orange-300 dark:ring-orange-300/20',
    description: '图片已生成，但未成功导入图库',
  },
};

const defaultFormState: FormState = {
  name: '',
  prompt: '',
  negativePrompt: '',
  model: modelOptions[0].value,
  size: sizeOptions[0],
  seed: '',
  steps: '30',
  guidance: '3.5',
};

const initialJobs: AiImageJob[] = [
  {
    id: 'job-preview-01',
    name: '深海玻璃柜',
    status: 'succeeded',
    prompt:
      'A premium cosmetic display set inside a translucent undersea cabinet, cinematic lighting, jellyfish, teal and gold, product poster.',
    negativePrompt: 'blurry, watermark, low quality, duplicated object',
    model: 'Qwen/Qwen-Image',
    size: '1216x832',
    seed: '240318',
    steps: '32',
    guidance: '3.5',
    statusReason: null,
    errorMessage: null,
    createdAt: '2026-04-19T08:30:00.000Z',
    submittedAt: '2026-04-19T08:30:04.000Z',
    finishedAt: '2026-04-19T08:31:11.000Z',
    syncAttempts: 3,
    lastSyncedAt: '2026-04-19T08:31:12.000Z',
    outputs: [
      {
        id: 'output-preview-01',
        outputIndex: 0,
        status: 'ready',
        imageAssetId: 'img_ai_9xk41',
        pageId: 'page_ai_9xk41',
        imageUrl: '/api/images/img_ai_9xk41/original',
        pageUrl: '/api/pages/page_ai_9xk41',
        errorMessage: null,
        palette: ['#0f7f89', '#f7bb6d', '#f9f4ec'],
      },
      {
        id: 'output-preview-02',
        outputIndex: 1,
        status: 'ready',
        imageAssetId: 'img_ai_9xk42',
        pageId: 'page_ai_9xk42',
        imageUrl: '/api/images/img_ai_9xk42/original',
        pageUrl: '/api/pages/page_ai_9xk42',
        errorMessage: null,
        palette: ['#1d3557', '#61c0bf', '#f4d35e'],
      },
    ],
    timeline: [
      {
        label: '已创建',
        description: '任务已进入系统，等待提交到生成服务',
        at: '2026-04-19T08:30:00.000Z',
      },
      {
        label: '已提交',
        description: '参数已发送到生成服务',
        at: '2026-04-19T08:30:04.000Z',
      },
      {
        label: '处理中',
        description: '系统正在查询远端任务进度',
        at: '2026-04-19T08:30:36.000Z',
      },
      {
        label: '已完成',
        description: '结果图已导入本地图库并生成展示页',
        at: '2026-04-19T08:31:11.000Z',
      },
    ],
  },
  {
    id: 'job-preview-02',
    name: '春季快闪橱窗',
    status: 'processing',
    prompt:
      'Spring campaign window installation, oversized paper flowers, brushed aluminum stage, magazine editorial style, wide shot.',
    negativePrompt: '',
    model: 'Qwen/Qwen-Image',
    size: '1536x1024',
    seed: '',
    steps: '28',
    guidance: '4.0',
    statusReason: null,
    errorMessage: null,
    createdAt: '2026-04-19T09:04:00.000Z',
    submittedAt: '2026-04-19T09:04:02.000Z',
    finishedAt: null,
    syncAttempts: 2,
    lastSyncedAt: '2026-04-19T09:05:04.000Z',
    outputs: [],
    timeline: [
      {
        label: '已创建',
        description: '任务已进入系统，等待提交到生成服务',
        at: '2026-04-19T09:04:00.000Z',
      },
      {
        label: '已提交',
        description: '参数已发送到生成服务',
        at: '2026-04-19T09:04:02.000Z',
      },
      {
        label: '处理中',
        description: '正在生成图片，结果会自动进入图库',
        at: '2026-04-19T09:04:36.000Z',
      },
    ],
  },
  {
    id: 'job-preview-03',
    name: '电商主图补帧',
    status: 'import_failed',
    prompt:
      'Minimal product hero with milky acrylic pedestal and reflective silver drape, centered composition, soft rim light.',
    negativePrompt: 'text, logo, watermark',
    model: 'Qwen/Qwen-Image',
    size: '1024x1024',
    seed: '912',
    steps: '26',
    guidance: '3.2',
    statusReason: '图片已生成，但入库阶段返回文件系统错误',
    errorMessage: '图片已生成，但导入图库失败，请复制参数后重新创建任务。',
    createdAt: '2026-04-19T07:40:00.000Z',
    submittedAt: '2026-04-19T07:40:03.000Z',
    finishedAt: '2026-04-19T07:41:08.000Z',
    syncAttempts: 4,
    lastSyncedAt: '2026-04-19T07:41:10.000Z',
    outputs: [
      {
        id: 'output-preview-03',
        outputIndex: 0,
        status: 'failed',
        imageAssetId: null,
        pageId: null,
        imageUrl: null,
        pageUrl: null,
        errorMessage: '本地图片导入失败',
        palette: ['#4c3f91', '#f0a04b', '#f2f2f2'],
      },
    ],
    timeline: [
      {
        label: '已创建',
        description: '任务已进入系统，等待提交到生成服务',
        at: '2026-04-19T07:40:00.000Z',
      },
      {
        label: '已提交',
        description: '参数已发送到生成服务',
        at: '2026-04-19T07:40:03.000Z',
      },
      {
        label: '处理中',
        description: '生成服务已返回图片，准备导入图库',
        at: '2026-04-19T07:40:28.000Z',
      },
      {
        label: '导入失败',
        description: '图片已生成，但未成功导入本地图库',
        at: '2026-04-19T07:41:08.000Z',
      },
    ],
  },
  {
    id: 'job-preview-04',
    name: '夜色舞台海报',
    status: 'failed',
    prompt:
      'A dramatic concert poster with glossy black stage, laser beams, crimson haze, and dense crowd silhouettes, premium editorial feel.',
    negativePrompt: 'blurry, extra fingers, watermark',
    model: 'Qwen/Qwen-Image',
    size: '832x1216',
    seed: '',
    steps: '30',
    guidance: '3.8',
    statusReason: 'Prompt 涉及不可用描述，远端返回失败',
    errorMessage: '服务返回失败，请调整参数后重试。',
    createdAt: '2026-04-18T16:12:00.000Z',
    submittedAt: '2026-04-18T16:12:02.000Z',
    finishedAt: '2026-04-18T16:12:19.000Z',
    syncAttempts: 1,
    lastSyncedAt: '2026-04-18T16:12:19.000Z',
    outputs: [],
    timeline: [
      {
        label: '已创建',
        description: '任务已进入系统，等待提交到生成服务',
        at: '2026-04-18T16:12:00.000Z',
      },
      {
        label: '已提交',
        description: '参数已发送到生成服务',
        at: '2026-04-18T16:12:02.000Z',
      },
      {
        label: '生成失败',
        description: '服务返回失败，请调整参数后重试',
        at: '2026-04-18T16:12:19.000Z',
      },
    ],
  },
];

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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumberLabel(value: number, singular: string, plural = singular): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getPromptExcerpt(prompt: string): string {
  return prompt.length > 96 ? `${prompt.slice(0, 96)}...` : prompt;
}

function isTerminalStatus(status: ImageJobStatus): boolean {
  return ['succeeded', 'failed', 'timed_out', 'canceled', 'import_failed'].includes(status);
}

function createPaletteSeed(input: string): [string, string, string] {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  const hueA = Math.abs(hash) % 360;
  const hueB = (hueA + 42) % 360;
  const hueC = (hueA + 98) % 360;

  return [
    `hsl(${hueA} 76% 58%)`,
    `hsl(${hueB} 74% 68%)`,
    `hsl(${hueC} 88% 92%)`,
  ];
}

function createReadyOutputs(job: AiImageJob): JobOutput[] {
  return [0, 1].map((outputIndex) => ({
    id: `${job.id}-output-${outputIndex}`,
    outputIndex,
    status: 'ready',
    imageAssetId: `img_${job.id.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${outputIndex + 1}`,
    pageId: `page_${job.id.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${outputIndex + 1}`,
    imageUrl: `/api/images/${job.id}/outputs/${outputIndex + 1}`,
    pageUrl: `/api/pages/${job.id}-output-${outputIndex + 1}`,
    errorMessage: null,
    palette: createPaletteSeed(`${job.prompt}-${outputIndex}`),
  }));
}

function advanceJob(job: AiImageJob): AiImageJob {
  const syncedAt = new Date().toISOString();

  if (job.status === 'queued') {
    return {
      ...job,
      status: 'submitted',
      submittedAt: syncedAt,
      syncAttempts: job.syncAttempts + 1,
      lastSyncedAt: syncedAt,
      timeline: [
        ...job.timeline,
        {
          label: '已提交',
          description: '参数已发送到生成服务',
          at: syncedAt,
        },
      ],
    };
  }

  if (job.status === 'submitted') {
    return {
      ...job,
      status: 'processing',
      syncAttempts: job.syncAttempts + 1,
      lastSyncedAt: syncedAt,
      timeline: [
        ...job.timeline,
        {
          label: '处理中',
          description: '正在生成图片，结果会自动进入图库',
          at: syncedAt,
        },
      ],
    };
  }

  if (job.status === 'processing') {
    return {
      ...job,
      status: 'succeeded',
      statusReason: null,
      errorMessage: null,
      finishedAt: syncedAt,
      syncAttempts: job.syncAttempts + 1,
      lastSyncedAt: syncedAt,
      outputs: createReadyOutputs(job),
      timeline: [
        ...job.timeline,
        {
          label: '已完成',
          description: '图片已生成并导入本地图库',
          at: syncedAt,
        },
      ],
    };
  }

  return {
    ...job,
    syncAttempts: job.syncAttempts + 1,
    lastSyncedAt: syncedAt,
  };
}

function NoticeBanner({ notice }: { notice: NoticeState }) {
  const toneClass =
    notice.tone === 'success'
      ? 'border-emerald-200/80 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'
      : notice.tone === 'warning'
        ? 'border-amber-200/80 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200'
        : 'border-sky-200/80 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
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

function OutputArtwork({ palette }: { palette: [string, string, string] }) {
  const [primary, secondary, neutral] = palette;

  return (
    <div
      className="relative h-40 overflow-hidden rounded-[24px] border border-white/50 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.85)] dark:border-white/10"
      style={{
        background: `linear-gradient(140deg, ${primary}, ${secondary} 46%, ${neutral})`,
      }}
    >
      <div className="absolute inset-x-6 top-6 h-20 rounded-full bg-white/18 blur-2xl" />
      <div className="absolute inset-x-7 bottom-8 h-14 rounded-full bg-zinc-950/20 blur-2xl" />
      <div className="absolute left-6 top-8 h-24 w-20 rounded-[28px] border border-white/45 bg-white/20 backdrop-blur-sm" />
      <div className="absolute right-6 top-6 h-16 w-16 rounded-full border border-white/35 bg-white/15" />
      <div className="absolute bottom-6 right-7 h-10 w-28 rounded-full border border-white/40 bg-white/20" />
    </div>
  );
}

export default function AIImageWorkspace({
  images,
  onViewAssets,
}: AIImageWorkspaceProps) {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [jobs, setJobs] = useState<AiImageJob[]>(initialJobs);
  const [statusFilter, setStatusFilter] = useState<JobFilterStatus>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [nameCustomized, setNameCustomized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>({
    tone: 'info',
    text: '设计稿演示：当前展示 AI 生图工作台的推荐信息架构与交互状态。',
  });
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const filteredJobs = jobs.filter((job) => {
    const searchValue = deferredSearchText.trim().toLowerCase();
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesSearch =
      searchValue.length === 0 ||
      `${job.name} ${job.prompt} ${job.model}`.toLowerCase().includes(searchValue);

    return matchesStatus && matchesSearch;
  });

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const succeededCount = jobs.filter((job) => job.status === 'succeeded').length;
  const processingCount = jobs.filter((job) => ['queued', 'submitted', 'processing'].includes(job.status)).length;
  const importReadyOutputs = jobs.reduce((count, job) => (
    count + job.outputs.filter((output) => output.status === 'ready').length
  ), 0);

  async function handleCopy(value: string, key: string) {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
  }

  async function handleSubmit() {
    if (!form.prompt.trim()) {
      setErrorMessage('请先输入 Prompt。');
      return;
    }

    if (!form.name.trim()) {
      setErrorMessage('请补充任务名称。');
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 420);
    });

    const createdAt = new Date().toISOString();
    const newJob: AiImageJob = {
      id: `job-demo-${Date.now()}`,
      name: form.name.trim(),
      status: 'submitted',
      prompt: form.prompt.trim(),
      negativePrompt: form.negativePrompt.trim(),
      model: form.model,
      size: form.size,
      seed: form.seed.trim(),
      steps: form.steps.trim(),
      guidance: form.guidance.trim(),
      statusReason: null,
      errorMessage: null,
      createdAt,
      submittedAt: createdAt,
      finishedAt: null,
      syncAttempts: 0,
      lastSyncedAt: createdAt,
      outputs: [],
      timeline: [
        {
          label: '已创建',
          description: '任务已进入系统，等待提交到生成服务',
          at: createdAt,
        },
        {
          label: '已提交',
          description: '参数已发送到生成服务',
          at: createdAt,
        },
      ],
    };

    setJobs((previous) => [newJob, ...previous]);
    setHighlightedJobId(newJob.id);
    setNotice({
      tone: 'info',
      text: '任务已提交，正在生成中。结果会自动进入图库，刷新页面后仍可继续追踪。',
    });
    startTransition(() => {
      setSelectedJobId(newJob.id);
    });
    setSubmitting(false);
  }

  function handleRefreshJob(jobId: string) {
    const currentJob = jobs.find((job) => job.id === jobId);

    if (!currentJob) {
      return;
    }

    const nextJob = advanceJob(currentJob);

    setJobs((previous) => previous.map((job) => (
      job.id === jobId ? nextJob : job
    )));

    setNotice(
      nextJob.status === 'succeeded'
        ? {
            tone: 'success',
            text: '图片已生成并导入图库，可直接复制原图链接或打开展示页。',
          }
        : {
            tone: 'info',
            text: '任务状态已刷新。实时更新断开时，也可以继续手动刷新。',
          },
    );
  }

  function handleCancelJob(jobId: string) {
    setJobs((previous) => previous.map((job) => {
      if (job.id !== jobId || isTerminalStatus(job.status)) {
        return job;
      }

      const canceledAt = new Date().toISOString();

      return {
        ...job,
        status: 'canceled',
        finishedAt: canceledAt,
        lastSyncedAt: canceledAt,
        statusReason: '取消后任务不会继续推进，已生成结果也不会再导入。',
        timeline: [
          ...job.timeline,
          {
            label: '已取消',
            description: '任务已取消，不再继续处理',
            at: canceledAt,
          },
        ],
      };
    }));

    setNotice({
      tone: 'warning',
      text: '任务已取消，不再继续推进。',
    });
  }

  function handleReuseJob(job: AiImageJob) {
    setForm({
      name: job.name,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      model: job.model,
      size: job.size,
      seed: job.seed,
      steps: job.steps,
      guidance: job.guidance,
    });
    setNameCustomized(true);
    setShowNegativePrompt(job.negativePrompt.length > 0);
    setShowAdvancedSettings(job.seed.length > 0 || job.steps.length > 0 || job.guidance.length > 0);
    setErrorMessage(null);
    setNotice({
      tone: 'info',
      text: `已带回“${job.name}”的参数，可以直接微调后再次生成。`,
    });
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_32px_90px_-50px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_36%),radial-gradient(circle_at_80%_20%,_rgba(244,114,182,0.18),_transparent_30%),linear-gradient(135deg,_rgba(248,250,252,0.92),_rgba(255,255,255,0.78))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_36%),radial-gradient(circle_at_80%_20%,_rgba(244,114,182,0.16),_transparent_28%),linear-gradient(135deg,_rgba(24,24,27,0.98),_rgba(10,10,10,0.94))]" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium tracking-[0.18em] text-white dark:bg-white dark:text-zinc-950">
                  AI 生图工作台
                </span>
                <span className="rounded-full border border-zinc-300/80 bg-white/70 px-3 py-1 text-xs text-zinc-600 backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
                  设计稿演示
                </span>
                <span className="rounded-full border border-emerald-200/80 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                  SSE 已连接
                </span>
              </div>
              <h3 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                把 Prompt、异步任务和图库回收放在同一个操作面里。
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                第一阶段只保留最小可用闭环：创建任务、追踪状态、查看结果、回到图库继续使用。复杂参数默认折叠，
                失败时则能快速看到原因并复制参数继续迭代。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricCard
                label="最近任务"
                value={formatNumberLabel(jobs.length, '个')}
                hint="统一在右侧列表追踪，不需要离开工作台"
              />
              <MetricCard
                label="生成成功"
                value={formatNumberLabel(succeededCount, '个')}
                hint="成功后默认回收到本地图片资产库"
              />
              <MetricCard
                label="已入库结果"
                value={formatNumberLabel(importReadyOutputs, '张')}
                hint={`${processingCount} 个任务仍在进行中`}
              />
            </div>
          </div>
        </div>
      </div>

      {notice ? <NoticeBanner notice={notice} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_24px_72px_-52px_rgba(15,23,42,0.55)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">创建任务</p>
              <h4 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">先把基础字段填完整</h4>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-400">
              <div>建议生成幂等键</div>
              <div className="mt-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-200">img_req_01hsyx8p4t</div>
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
                  setForm((previous) => ({ ...previous, name: event.target.value }));
                }}
                placeholder="默认取 Prompt 前 12 到 20 个字符"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Prompt</span>
              <textarea
                aria-label="Prompt"
                value={form.prompt}
                onChange={(event) => {
                  const nextPrompt = event.target.value;
                  setForm((previous) => ({
                    ...previous,
                    prompt: nextPrompt,
                    name: nameCustomized ? previous.name : buildSuggestedName(nextPrompt),
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
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">模型</span>
                <select
                  aria-label="模型"
                  value={form.model}
                  onChange={(event) => {
                    setForm((previous) => ({ ...previous, model: event.target.value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {modelOptions.find((option) => option.value === form.model)?.description}
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">尺寸</span>
                <select
                  aria-label="尺寸"
                  value={form.size}
                  onChange={(event) => {
                    setForm((previous) => ({ ...previous, size: event.target.value }));
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
                onClick={() => setShowNegativePrompt((previous) => !previous)}
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
                      setForm((previous) => ({ ...previous, negativePrompt: event.target.value }));
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
                onClick={() => setShowAdvancedSettings((previous) => !previous)}
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
                        setForm((previous) => ({ ...previous, seed: event.target.value }));
                      }}
                      placeholder="留空表示随机"
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Steps</span>
                    <input
                      aria-label="Steps"
                      value={form.steps}
                      onChange={(event) => {
                        setForm((previous) => ({ ...previous, steps: event.target.value }));
                      }}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Guidance</span>
                    <input
                      aria-label="Guidance"
                      value={form.guidance}
                      onChange={(event) => {
                        setForm((previous) => ({ ...previous, guidance: event.target.value }));
                      }}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {errorMessage ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                {errorMessage}
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
            {filteredJobs.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">还没有生成任务</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  输入提示词后，系统会异步生成图片并自动收录到图库。
                </p>
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                  示例 Prompt: premium spring sale poster, realistic flowers, cinematic lighting
                </p>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const meta = statusMeta[job.status];
                const running = ['queued', 'submitted', 'processing'].includes(job.status);

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
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
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
                          <span>{job.size}</span>
                          <span>{formatNumberLabel(job.outputs.length, '张结果')}</span>
                        </div>
                        {job.errorMessage ? (
                          <p className={`mt-3 text-sm ${meta.accent}`}>{job.errorMessage}</p>
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
                          onClick={() => handleRefreshJob(job.id)}
                          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          刷新状态
                        </button>
                        {!isTerminalStatus(job.status) ? (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.id)}
                            className="rounded-full border border-amber-300 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 dark:border-amber-400/20 dark:text-amber-300"
                          >
                            取消任务
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
          {images.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-400">
              当前图库暂无图片。AI 生图成功后，这里会出现带来源标识与 Prompt 摘要的资产卡片。
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {images.slice(0, 3).map((image) => (
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
                      <span className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        手动上传
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      设计稿中，AI 导入结果会在此处显示来源任务、生成时间和 Prompt 摘要。
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
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">来源任务 / Prompt 摘要 / 生成时间</p>
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                让运营在图库里也能追溯图片来源，而不是把 AI 结果当普通上传图处理。
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
                新能力只在来源信息上增强，不另起一套新的图库系统。
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
                onClick={() => setSelectedJobId(null)}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                关闭
              </button>
            </div>

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
                    <dd>{formatTime(selectedJob.finishedAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>模型 / 尺寸</dt>
                    <dd>{selectedJob.model} / {selectedJob.size}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">任务诊断</p>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {selectedJob.statusReason ?? '当前任务没有额外错误说明。'}
                </p>
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  最近同步：{formatTime(selectedJob.lastSyncedAt)}，共 {selectedJob.syncAttempts} 次
                </div>
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
                  onClick={() => handleRefreshJob(selectedJob.id)}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  刷新状态
                </button>
              </div>
              <ol className="mt-5 space-y-4">
                {selectedJob.timeline.map((item, index) => (
                  <li key={`${item.label}-${item.at}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-zinc-950 dark:bg-white" />
                      {index < selectedJob.timeline.length - 1 ? (
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
            </section>

            <section className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">输出结果</p>
                  <h5 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">成功图像直接给到下游使用链路</h5>
                </div>
                {selectedJob.outputs.some((output) => output.status === 'ready') ? (
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
                  {selectedJob.outputs.map((output) => (
                    <div
                      key={output.id}
                      className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="p-4">
                        <OutputArtwork palette={output.palette} />
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            结果 {output.outputIndex + 1}
                          </p>
                          <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            {output.status === 'ready' ? '已入库' : output.status === 'pending' ? '处理中' : '失败'}
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
                          {output.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleCopy(output.imageUrl ?? '', `${output.id}-image`);
                              }}
                              className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                              {copiedKey === `${output.id}-image` ? '已复制直链' : '复制直链'}
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
                              {copiedKey === `${output.id}-page` ? '已复制展示页链接' : '打开展示页'}
                            </button>
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
                <div className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Prompt</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{selectedJob.prompt}</dd>
                </div>
                <div className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Negative Prompt</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    {selectedJob.negativePrompt || '未填写'}
                  </dd>
                </div>
                <div className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">模型 / 尺寸</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    {selectedJob.model} / {selectedJob.size}
                  </dd>
                </div>
                <div className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Seed / Steps / Guidance</dt>
                  <dd className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    {selectedJob.seed || '随机'} / {selectedJob.steps || '默认'} / {selectedJob.guidance || '默认'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
