import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';
import { computeDefensiveMetrics } from '../../services/stats';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const teamId = requireParam(event, 'teamId');

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new NotFoundError('Team');
  }

  await assertHasRole(user.id, { organizationId: team.organizationId, teamId }, ['ORG_ADMIN', 'TEAM_ADMIN', 'PARENT']);

  return ok(await computeDefensiveMetrics(teamId));
});
