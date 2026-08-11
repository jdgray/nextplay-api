import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';

/** Unauthenticated: name-only team picker for the signup form, scoped to one org. */
export const handler = withHandler(async (event) => {
  const organizationId = requireParam(event, 'orgId');
  const teams = await prisma.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return ok(teams);
});
