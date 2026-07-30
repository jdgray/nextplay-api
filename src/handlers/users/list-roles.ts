import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser } from '../../lib/auth-context';
import { ForbiddenError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const id = requireParam(event, 'id');

  if (caller.id !== id) {
    throw new ForbiddenError('You can only view your own roles');
  }

  const roles = await prisma.userRole.findMany({ where: { userId: id } });
  return ok(roles);
});
