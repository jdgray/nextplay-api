import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser } from '../../lib/auth-context';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const id = requireParam(event, 'id');

  if (caller.id !== id) {
    const callerRoles = await prisma.userRole.findMany({ where: { userId: caller.id } });
    const orgIds = callerRoles.map((r) => r.organizationId).filter((v): v is string => !!v);
    const teamIds = callerRoles.map((r) => r.teamId).filter((v): v is string => !!v);

    const sharesScope = await prisma.userRole.findFirst({
      where: {
        userId: id,
        OR: [{ organizationId: { in: orgIds } }, { teamId: { in: teamIds } }],
      },
    });
    if (!sharesScope) {
      throw new ForbiddenError();
    }
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User');
  }

  return ok({ id: user.id, email: user.email, fullName: user.fullName });
});
