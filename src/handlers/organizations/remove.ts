import { withHandler, noContent } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  await assertHasRole(user.id, { organizationId: id }, ['ORG_ADMIN']);

  await prisma.organization.delete({ where: { id } });
  return noContent();
});
