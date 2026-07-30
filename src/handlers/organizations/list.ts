import { withHandler, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { requireUser } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);

  const organizations = await prisma.organization.findMany({
    where: { userRoles: { some: { userId: user.id } } },
    orderBy: { name: 'asc' },
  });

  return ok(organizations);
});
