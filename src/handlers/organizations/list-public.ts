import { withHandler, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';

/** Unauthenticated: name-only organization picker for the signup form. */
export const handler = withHandler(async () => {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return ok(organizations);
});
