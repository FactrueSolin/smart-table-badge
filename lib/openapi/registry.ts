import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

export function createOpenApiRouteRegistrar(register: (registry: OpenAPIRegistry) => void): () => void {
  let registered = false;

  return () => {
    if (registered) {
      return;
    }

    register(openApiRegistry);
    registered = true;
  };
}

export { z };
