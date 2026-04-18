import type {
  ImageGenerationProvider,
  ProviderSubmitInput,
  ProviderSubmittedTask,
  ProviderTaskSnapshot,
} from '@/lib/ai/image-generation/providers/types';
import { ModelScopeClient } from '@/lib/ai/image-generation/providers/modelscope/client';

function mapTaskStatus(taskStatus: string): ProviderTaskSnapshot['status'] {
  const normalized = taskStatus.toUpperCase();

  if (normalized === 'SUCCEED' || normalized === 'SUCCEEDED') {
    return 'succeeded';
  }

  if (normalized === 'FAILED') {
    return 'failed';
  }

  if (normalized === 'RUNNING' || normalized === 'PROCESSING') {
    return 'running';
  }

  return 'pending';
}

export class ModelScopeImageGenerationProvider implements ImageGenerationProvider {
  readonly provider = 'modelscope' as const;

  constructor(private readonly client: ModelScopeClient = new ModelScopeClient()) {}

  async submit(input: ProviderSubmitInput): Promise<ProviderSubmittedTask> {
    const submitted = await this.client.submitImageGeneration(input);

    return {
      taskId: submitted.taskId,
      requestId: submitted.requestId,
      raw: submitted.raw,
    };
  }

  async getTask(taskId: string): Promise<ProviderTaskSnapshot> {
    const snapshot = await this.client.getTask(taskId);

    return {
      status: mapTaskStatus(snapshot.taskStatus),
      outputImages: snapshot.outputImages,
      requestId: snapshot.requestId,
      errorMessage: snapshot.errorMessage,
      raw: snapshot.raw,
    };
  }
}
