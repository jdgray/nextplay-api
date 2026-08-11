import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const gameId = requireParam(event, 'gameId');

  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { team: true } });
  if (!game) {
    throw new NotFoundError('Game');
  }

  await assertHasRole(user.id, { organizationId: game.team.organizationId, teamId: game.teamId }, ['ORG_ADMIN', 'TEAM_ADMIN', 'PARENT']);

  const events = await prisma.defensiveEvent.findMany({ where: { gameId }, orderBy: { minute: 'asc' } });
  return ok(events);
});
