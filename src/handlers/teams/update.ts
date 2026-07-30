import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { updateTeamSchema } from '../../validation/team';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');
  const input = updateTeamSchema.parse(parseJsonBody(event));

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    throw new NotFoundError('Team');
  }

  await assertHasRole(user.id, { organizationId: team.organizationId, teamId: team.id }, [
    'ORG_ADMIN',
    'COACH',
    'TEAM_MANAGER',
  ]);

  const updated = await prisma.team.update({ where: { id }, data: input });
  return ok(updated);
});
