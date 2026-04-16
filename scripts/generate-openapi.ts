import { mkdir, writeFile } from 'node:fs/promises';
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
  const publicDir = path.join(process.cwd(), 'public');
  const docsDir = path.join(process.cwd(), 'docs');
  const jsonPath = path.join(publicDir, 'openapi.json');
  const yamlPath = path.join(docsDir, 'openapi.yaml');

  await mkdir(publicDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  await writeFile(jsonPath, JSON.stringify(document, null, 2) + '\n', 'utf-8');
  await writeFile(yamlPath, stringify(document), 'utf-8');
}

void main();
