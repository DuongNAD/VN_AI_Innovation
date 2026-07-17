import { readFileSync } from 'fs';
import { join } from 'path';
import { handleRoute } from '@/lib/errors';

let cachedYaml: string | null = null;

export const GET = handleRoute(async () => {
  if (cachedYaml === null) {
    cachedYaml = readFileSync(join(process.cwd(), 'openapi.yaml'), 'utf8');
  }
  return new Response(cachedYaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  });
});