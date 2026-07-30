import { PrismaClient } from '@prisma/client';

// Module-scope singleton: a warm Lambda container reuses this across
// invocations instead of opening a new connection (and pool) every time.
// Never call `$disconnect()` from inside a handler.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
