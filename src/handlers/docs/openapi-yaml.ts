import { readFileSync } from 'fs';
import { join } from 'path';
import type { ApiHandler } from '../../lib/http';

const SPEC_PATH = join(__dirname, '../../../docs/openapi.yaml');

export const handler: ApiHandler = async () => {
  const yaml = readFileSync(SPEC_PATH, 'utf-8');
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/yaml' },
    body: yaml,
  };
};
