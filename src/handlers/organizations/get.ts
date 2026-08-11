import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  await assertHasRole(user.id, { organizationId: id }, ['ORG_ADMIN', 'TEAM_ADMIN', 'PARENT']);

  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    throw new NotFoundError('Organization');
  }

  return ok(organization);
});
