import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  ImageGenerationJobRecord,
  ImageGenerationJobStatus,
  ImageGenerationJobStore,
  ImageGenerationProviderName,
} from '@/lib/ai/image-generation/types';

const DEFAULT_STORE: ImageGenerationJobStore = {
  jobs: [],
};

let mutationQueue: Promise<void> = Promise.resolve();

function getDataDir(): string {
  return path.join(process.cwd(), 'data');
}

function getStorePath(): string {
  return path.join(getDataDir(), 'image-generation-jobs.json');
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
}

async function withMutationLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = mutationQueue;
  let release = () => {};

  mutationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await action();
  } finally {
    release();
  }
}

function normalizeJobStore(store: Partial<ImageGenerationJobStore>): ImageGenerationJobStore {
  return {
    jobs: Array.isArray(store.jobs) ? store.jobs : [],
  };
}

function sortJobsDescending(jobs: ImageGenerationJobRecord[]): ImageGenerationJobRecord[] {
  return [...jobs].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return right.id.localeCompare(left.id);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export interface ImageGenerationRepository {
  getJob(jobId: string): Promise<ImageGenerationJobRecord | null>;
  getJobByIdempotencyKey(key: string): Promise<ImageGenerationJobRecord | null>;
  createJob(job: ImageGenerationJobRecord): Promise<ImageGenerationJobRecord>;
  saveJob(job: ImageGenerationJobRecord): Promise<ImageGenerationJobRecord>;
  listJobs(filters: {
    status?: ImageGenerationJobStatus;
    provider?: ImageGenerationProviderName;
    model?: string;
  }): Promise<ImageGenerationJobRecord[]>;
  listDueJobs(now: Date, limit: number): Promise<ImageGenerationJobRecord[]>;
}

export class FileImageGenerationRepository implements ImageGenerationRepository {
  private async loadStore(): Promise<ImageGenerationJobStore> {
    await ensureStoreDir();

    try {
      const raw = await fs.readFile(getStorePath(), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ImageGenerationJobStore>;
      return normalizeJobStore(parsed);
    } catch {
      await this.saveStore(DEFAULT_STORE);
      return DEFAULT_STORE;
    }
  }

  private async saveStore(store: ImageGenerationJobStore): Promise<void> {
    await ensureStoreDir();
    await fs.writeFile(getStorePath(), JSON.stringify(store, null, 2), 'utf-8');
  }

  async getJob(jobId: string): Promise<ImageGenerationJobRecord | null> {
    const store = await this.loadStore();
    return store.jobs.find((job) => job.id === jobId) ?? null;
  }

  async getJobByIdempotencyKey(key: string): Promise<ImageGenerationJobRecord | null> {
    const store = await this.loadStore();
    return store.jobs.find((job) => job.idempotencyKey === key) ?? null;
  }

  async createJob(job: ImageGenerationJobRecord): Promise<ImageGenerationJobRecord> {
    return withMutationLock(async () => {
      const store = await this.loadStore();
      store.jobs.push(job);
      await this.saveStore(store);
      return job;
    });
  }

  async saveJob(job: ImageGenerationJobRecord): Promise<ImageGenerationJobRecord> {
    return withMutationLock(async () => {
      const store = await this.loadStore();
      const index = store.jobs.findIndex((item) => item.id === job.id);

      if (index === -1) {
        store.jobs.push(job);
      } else {
        store.jobs[index] = job;
      }

      await this.saveStore(store);
      return job;
    });
  }

  async listJobs(filters: {
    status?: ImageGenerationJobStatus;
    provider?: ImageGenerationProviderName;
    model?: string;
  }): Promise<ImageGenerationJobRecord[]> {
    const store = await this.loadStore();

    return sortJobsDescending(
      store.jobs.filter((job) => {
        if (filters.status && job.status !== filters.status) {
          return false;
        }

        if (filters.provider && job.provider !== filters.provider) {
          return false;
        }

        if (filters.model && job.model !== filters.model) {
          return false;
        }

        return true;
      }),
    );
  }

  async listDueJobs(now: Date, limit: number): Promise<ImageGenerationJobRecord[]> {
    const store = await this.loadStore();

    return sortJobsDescending(
      store.jobs.filter((job) => {
        if (!job.remoteTaskId || !job.nextSyncAt) {
          return false;
        }

        if (
          job.status === 'succeeded' ||
          job.status === 'failed' ||
          job.status === 'timed_out' ||
          job.status === 'canceled' ||
          job.status === 'import_failed'
        ) {
          return false;
        }

        return new Date(job.nextSyncAt).getTime() <= now.getTime();
      }),
    ).slice(0, limit);
  }
}

export const imageGenerationRepository = new FileImageGenerationRepository();
