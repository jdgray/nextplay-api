import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const organizationId = requireParam(event, 'orgId');

  await assertHasRole(caller.id, { organizationId }, ['ORG_ADMIN']);

  const scope = { OR: [{ organizationId }, { team: { organizationId } }] };
  const users = await prisma.user.findMany({
    where: { roles: { some: scope } },
    include: { roles: { where: scope } },
    orderBy: { fullName: 'asc' },
  });

  return ok(
    users.map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, roles: u.roles })),
  );
});
