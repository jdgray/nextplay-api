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

  await assertHasRole(user.id, { organizationId: game.team.organizationId, teamId: game.teamId }, [
    'ORG_ADMIN',
    'COACH',
    'ASSISTANT_COACH',
    'TEAM_MANAGER',
    'VIEWER',
  ]);

  const logs = await prisma.playerGameLog.findMany({
    where: { gameId },
    include: { subIntervals: true, goalEvents: true, assistEvents: true, player: true },
  });

  return ok(logs);
});
