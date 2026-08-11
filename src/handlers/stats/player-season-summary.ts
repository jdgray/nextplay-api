import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';
import { computePlayerSeasonSummary } from '../../services/stats';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const player = await prisma.player.findUnique({ where: { id }, include: { team: true } });
  if (!player) {
    throw new NotFoundError('Player');
  }

  await assertHasRole(user.id, { organizationId: player.team.organizationId, teamId: player.teamId }, ['ORG_ADMIN', 'TEAM_ADMIN', 'PARENT']);

  return ok(await computePlayerSeasonSummary(id));
});
