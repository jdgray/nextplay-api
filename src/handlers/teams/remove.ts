import { withHandler, noContent } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    throw new NotFoundError('Team');
  }

  await assertHasRole(user.id, { organizationId: team.organizationId }, ['ORG_ADMIN']);

  await prisma.team.delete({ where: { id } });
  return noContent();
});
