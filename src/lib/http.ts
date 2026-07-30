import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from './errors';

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type ApiResult = APIGatewayProxyStructuredResultV2;
export type ApiHandler = (event: ApiEvent) => Promise<ApiResult>;

const JSON_HEADERS = { 'content-type': 'application/json' };

export function json(statusCode: number, body: unknown): ApiResult {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown): ApiResult => json(200, body);
export const created = (body: unknown): ApiResult => json(201, body);
export const noContent = (): ApiResult => ({ statusCode: 204, headers: JSON_HEADERS, body: '' });

export function parseJsonBody<T = unknown>(event: ApiEvent): T {
  if (!event.body) {
    throw new AppError('Request body is required', 400);
  }
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError('Request body must be valid JSON', 400);
  }
}

/**
 * Wraps a handler so every Lambda invocation returns a well-formed API
 * Gateway response instead of throwing — thrown AppErrors map to their
 * status code, zod/Prisma errors map to sensible defaults, anything else
 * becomes a logged 500.
 */
export function withHandler(handler: ApiHandler): ApiHandler {
  return async (event) => {
    try {
      return await handler(event);
    } catch (err) {
      if (err instanceof AppError) {
        return json(err.statusCode, { message: err.message, details: err.details });
      }
      if (err instanceof ZodError) {
        return json(400, { message: 'Validation failed', details: err.flatten() });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          return json(409, { message: 'Resource already exists', details: err.meta });
        }
        if (err.code === 'P2025') {
          return json(404, { message: 'Resource not found' });
        }
      }
      // eslint-disable-next-line no-console
      console.error('Unhandled error', err);
      return json(500, { message: 'Internal server error' });
    }
  };
}
