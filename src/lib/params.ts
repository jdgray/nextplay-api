import { AppError } from './errors';
import type { ApiEvent } from './http';

export function requireParam(event: ApiEvent, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) {
    throw new AppError(`Missing path parameter: ${name}`, 400);
  }
  return value;
}

export function queryParam(event: ApiEvent, name: string): string | undefined {
  return event.queryStringParameters?.[name];
}
