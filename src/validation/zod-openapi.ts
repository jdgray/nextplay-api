import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Must run before any `.openapi()` metadata is attached to a schema, so every
// validation module imports `z` from here rather than from `zod` directly.
extendZodWithOpenApi(z);

export { z };
