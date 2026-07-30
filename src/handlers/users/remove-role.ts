import { withHandler, noContent } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const roleId = requireParam(event, 'roleId');

  const role = await prisma.userRole.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new NotFoundError('Role');
  }

  await assertHasRole(
    caller.id,
    { organizationId: role.organizationId ?? undefined, teamId: role.teamId ?? undefined },
    ['ORG_ADMIN'],
  );

  await prisma.userRole.delete({ where: { id: roleId } });
  return noContent();
});
