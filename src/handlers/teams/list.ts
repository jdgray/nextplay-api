import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const organizationId = requireParam(event, 'orgId');

  await assertHasRole(user.id, { organizationId }, [
    'ORG_ADMIN',
    'COACH',
    'ASSISTANT_COACH',
    'TEAM_MANAGER',
    'VIEWER',
  ]);

  const teams = await prisma.team.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  return ok(teams);
});
