import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const organizationId = requireParam(event, 'orgId');

  await assertHasRole(user.id, { organizationId }, ['ORG_ADMIN']);

  const requests = await prisma.membershipRequest.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, fullName: true } } },
  });

  return ok(requests);
});
