import { withHandler, created, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { createTeamSchema } from '../../validation/team';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const organizationId = requireParam(event, 'orgId');
  const input = createTeamSchema.parse(parseJsonBody(event));

  await assertHasRole(user.id, { organizationId }, ['ORG_ADMIN']);

  const team = await prisma.team.create({ data: { ...input, organizationId } });
  return created(team);
});
