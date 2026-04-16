import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { stringify } from 'yaml';

import { generateOpenApiDocument } from '@/lib/openapi/document';
import '@/app/api/pages/route';
import '@/app/api/pages/[id]/route';
import '@/app/api/current/route';
import '@/app/api/images/route';
import '@/app/api/images/[id]/route';
import '@/app/api/auth/login/route';
import '@/app/api/auth/logout/route';
import '@/app/api/auth/check/route';

async function main() {
  const document = generateOpenApiDocument();
  const expectedJson = JSON.stringify(document, null, 2) + '\n';
  const expectedYaml = stringify(document);

  const jsonPath = path.join(process.cwd(), 'public', 'openapi.json');
  const yamlPath = path.join(process.cwd(), 'docs', 'openapi.yaml');

  const [currentJson, currentYaml] = await Promise.all([
    readFile(jsonPath, 'utf-8'),
    readFile(yamlPath, 'utf-8'),
  ]);

  if (currentJson !== expectedJson || currentYaml !== expectedYaml) {
    throw new Error('OpenAPI 产物已过期，请先执行 pnpm openapi:generate');
  }
}

void main();
